import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { loadConfig } from '../src/config';

export const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';

export async function testApp(env: Record<string, string> = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    PGLITE_DIR: 'memory',
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    WEB_ORIGIN: 'http://localhost:5173',
    EXTENSION_IDS: EXT_ID,
    RATE_LIMIT: 'off',
    ...env,
  });
  const app = await createApp(config);
  await app.init();
  return app;
}

export const PASSWORD = 'correct horse battery staple';

// Creates the account if needed, then signs in with a password. Returns the access token (+ refresh token / cookie).
export async function signIn(app: INestApplication, email: string, client: 'web' | 'extension' = 'web') {
  const http = request(app.getHttpServer());
  const registered = client === 'web' ? await http.post('/api/auth/register').send({ email, password: PASSWORD }) : null;
  const res = registered?.status === 201
    ? registered // registering already starts a web session
    : await http.post('/api/auth/login').send({ email, password: PASSWORD, client }).expect(200);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('de92_rt='));
  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string | undefined,
    sessionId: res.body.sessionId as string,
    cookie: cookie?.split(';')[0],
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}
