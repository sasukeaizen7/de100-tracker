// Client for the NestJS API. The access token lives only in memory; the refresh
// token is an httpOnly cookie the page can't read.
const BASE = '/api';

let accessToken = null;
let refreshing = null;
const authListeners = new Set();

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function onAuthChange(fn) {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

function setToken(token) {
  const changed = Boolean(token) !== Boolean(accessToken);
  accessToken = token;
  if (changed) authListeners.forEach((fn) => fn(Boolean(token)));
}

async function errorFrom(res) {
  const body = await res.json().catch(() => null);
  const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  return new ApiError(msg || `Request failed (${res.status})`, res.status);
}

// One refresh at a time, shared by every caller.
function refresh() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-DE92-Client': 'web' },
    body: '{}',
  })
    .then(async (res) => (res.ok ? (await res.json()).accessToken : null))
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function restoreSession() {
  setToken(await refresh());
  return Boolean(accessToken);
}

export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }) },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });

  if (!accessToken) accessToken = await refresh();
  let res = accessToken ? await send() : null;
  if (!res || res.status === 401) {
    accessToken = await refresh();
    if (!accessToken) {
      setToken(null);
      throw new ApiError('Your session has ended. Please sign in again.', 401);
    }
    res = await send();
  }
  if (!res.ok) throw await errorFrom(res);
  return res.status === 204 ? null : res.json();
}

// --- Sign-in -----------------------------------------------------------------

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.status === 204 ? null : res.json();
}

export async function register(email, password) {
  const { accessToken: t } = await post('/auth/register', { email, password });
  setToken(t);
}

export async function login(email, password) {
  const { accessToken: t } = await post('/auth/login', { email, password, client: 'web' });
  setToken(t);
}

export const changePassword = (currentPassword, newPassword) =>
  api('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });

export async function getProviders() {
  try {
    const res = await fetch(`${BASE}/auth/providers`);
    if (res.ok) return await res.json();
  } catch {
    // API unreachable: fall through to email-only
  }
  return { password: true, google: false };
}

export const googleSignInUrl = `${BASE}/auth/google/start?client=web`;

export async function signOut() {
  try {
    if (accessToken) await api('/auth/logout', { method: 'POST' });
  } catch {
    // already signed out server-side
  }
  setToken(null);
}

export const signOutLocally = () => setToken(null);

// --- Live updates (Server-Sent Events over fetch, so we can send the token) ---

export function subscribeEvents(onChange) {
  const controller = new AbortController();
  let delay = 1000;

  (async function loop() {
    while (!controller.signal.aborted) {
      try {
        if (!accessToken) accessToken = await refresh();
        if (!accessToken) return setToken(null);
        const res = await fetch(`${BASE}/events`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
        if (res.status === 401) {
          accessToken = await refresh();
          if (!accessToken) return setToken(null);
          continue;
        }
        if (!res.ok) throw new Error(`events ${res.status}`);
        delay = 1000;

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (!/^event: change$/m.test(block)) continue;
            const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
            try {
              const event = JSON.parse(data);
              onChange(event);
              window.dispatchEvent(new CustomEvent('de92-change', { detail: event }));
            } catch { /* ignore malformed event */ }
          }
        }
        // The server closed the stream (e.g. this session was revoked); the next loop re-checks auth.
        accessToken = null;
      } catch {
        if (controller.signal.aborted) return;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30_000);
    }
  })();

  return () => controller.abort();
}

// --- Notes ---------------------------------------------------------------------

export function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  return api('/notes/images', { method: 'POST', body: form });
}
