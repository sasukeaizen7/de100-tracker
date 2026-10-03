import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';

export interface AppConfig {
  port: number;
  production: boolean;
  databaseUrl: string | null;
  pgliteDir: string | null; // null = in-memory (tests)
  jwtSecret: string;
  webOrigin: string;
  apiPublicUrl: string;
  extensionIds: string[];
  google: { clientId: string; clientSecret: string } | null;
  rateLimit: boolean;
}

export const CONFIG = Symbol('CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  const blank = (v?: string) => (v && v.trim() ? v.trim() : null);

  let jwtSecret = blank(env.JWT_SECRET);
  if (!jwtSecret) {
    if (production) throw new Error('JWT_SECRET is required in production');
    jwtSecret = randomBytes(48).toString('base64url');
    new Logger('Config').warn('JWT_SECRET not set: using a random one (access tokens reset on restart)');
  } else if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const databaseUrl = blank(env.DATABASE_URL);
  if (production && !databaseUrl) throw new Error('DATABASE_URL is required in production');

  const webOrigin = (blank(env.WEB_ORIGIN) ?? 'http://localhost:5173').replace(/\/$/, '');
  const googleId = blank(env.GOOGLE_CLIENT_ID);
  const googleSecret = blank(env.GOOGLE_CLIENT_SECRET);

  return {
    port: Number(env.PORT ?? 3000),
    production,
    databaseUrl,
    pgliteDir: env.PGLITE_DIR === 'memory' ? null : (blank(env.PGLITE_DIR) ?? './.data/pglite'),
    jwtSecret,
    webOrigin,
    apiPublicUrl: (blank(env.API_PUBLIC_URL) ?? `${webOrigin}/api`).replace(/\/$/, ''),
    extensionIds: (env.EXTENSION_IDS ?? '').split(',').map((s) => s.trim()).filter((s) => /^[a-p]{32}$/.test(s)),
    google: googleId && googleSecret ? { clientId: googleId, clientSecret: googleSecret } : null,
    rateLimit: env.RATE_LIMIT !== 'off',
  };
}
