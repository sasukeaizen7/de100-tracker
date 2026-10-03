import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sixDigitCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
export const hmac = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Minimal HS256 JWT: header.payload.signature, all base64url.
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString('base64url');
  return `${HEADER}.${body}.${hmac(secret, `${HEADER}.${body}`)}`;
}

export function verifyJwt<T>(token: string, secret: string): (T & { exp: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== HEADER) return null; // pins alg to HS256
  if (!safeEqual(parts[2], hmac(secret, `${parts[0]}.${parts[1]}`))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

// Short human-readable device label from a User-Agent header.
export function deviceLabel(userAgent: string | undefined, fallback: string) {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : null;
  return browser && os ? `${browser} on ${os}` : browser ?? fallback;
}
