// Sign-in against the NestJS API. The session (short-lived access token plus a
// rotating refresh token) is kept only in chrome.storage.local.
import { API_URL } from '../config.js';

const SESSION_KEY = 'session';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(msg || `Request failed (${res.status})`, res.status);
  }
  return data;
}

function deviceName() {
  return `Chrome extension on ${navigator.userAgentData?.platform || 'desktop'}`.slice(0, 60);
}

async function saveSession(tokens, previous = {}) {
  const session = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? previous.refreshToken, // null = a parallel refresh already rotated it
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    sessionId: tokens.sessionId,
    email: previous.email ?? null,
  };
  if (!session.email) {
    const me = await call('/me', { method: 'GET', token: session.accessToken });
    session.email = me.profile.email;
  }
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

let refreshing = null;

// A valid session (refreshed if it expires within a minute), or null when signed out.
export async function getSession({ forceRefresh = false } = {}) {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  if (!session) return null;
  if (!forceRefresh && session.expiresAt - 60_000 > Date.now()) return session;

  refreshing ??= call('/auth/refresh', { body: { refreshToken: session.refreshToken } })
    .then((tokens) => saveSession(tokens, session))
    .catch(async (err) => {
      if (err.status === 401) { await clearSession(); return null; } // revoked, expired, or disconnected
      throw err;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// Authenticated request; retries once after a refresh if the access token was rejected.
export async function authedCall(path, options = {}) {
  let session = await getSession();
  if (!session) throw new ApiError('Signed out', 401);
  try {
    return await call(path, { ...options, token: session.accessToken });
  } catch (err) {
    if (err.status !== 401) throw err;
    session = await getSession({ forceRefresh: true });
    if (!session) throw new ApiError('This browser was disconnected. Sign in again.', 401);
    return call(path, { ...options, token: session.accessToken });
  }
}

// --- Google: the API runs the OAuth flow, then hands back a one-time code (PKCE-bound) ---

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signInWithGoogle() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

  const start = new URL(`${API_URL}/auth/google/start`);
  start.search = new URLSearchParams({ client: 'extension', redirect_uri: chrome.identity.getRedirectURL('auth'), code_challenge: challenge });

  const result = new URL(await chrome.identity.launchWebAuthFlow({ url: start.href, interactive: true }));
  const code = result.searchParams.get('code');
  if (!code) throw new Error(result.searchParams.get('error') === 'cancelled' ? 'Sign-in was cancelled' : 'Google sign-in failed');

  return saveSession(await call('/auth/token', { body: { code, codeVerifier: verifier, deviceName: deviceName() } }));
}

// --- Email + password (create the account in the web app first) ---

export async function signInWithPassword(email, password) {
  return saveSession(await call('/auth/login', { body: { email, password, client: 'extension', deviceName: deviceName() } }), { email: email.trim().toLowerCase() });
}

export async function signOut() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  await clearSession();
  if (session) await call('/auth/logout', { token: session.accessToken }).catch(() => {}); // revoke server-side
}
