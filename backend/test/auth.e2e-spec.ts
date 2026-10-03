import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PASSWORD, signIn, testApp } from './helpers';

describe('authentication and sessions', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await testApp();
    http = request(app.getHttpServer());
  });
  afterAll(async () => {
    app.getHttpServer().closeAllConnections?.(); // drop the keep-alive socket left by fetch()
    await app.close();
  });
  afterEach(() => vi.restoreAllMocks());

  it('registers an account and signs the web app in with an httpOnly cookie', async () => {
    const res = await http.post('/api/auth/register').send({ email: 'New@Test.dev', password: PASSWORD }).expect(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeUndefined(); // web gets an httpOnly cookie instead
    expect(String(res.headers['set-cookie'])).toMatch(/de92_rt=.*HttpOnly.*SameSite=Strict/i);
    const me = (await http.get('/api/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200)).body;
    expect(me.profile).toMatchObject({ email: 'new@test.dev', hasPassword: true });
    expect(JSON.stringify(me)).not.toMatch(/scrypt|passwordHash/);
  });

  it('rejects duplicate accounts and weak passwords', async () => {
    await http.post('/api/auth/register').send({ email: 'new@test.dev', password: 'another password' }).expect(409);
    await http.post('/api/auth/register').send({ email: 'short@test.dev', password: 'short' }).expect(400);
    await http.post('/api/auth/register').send({ email: 'not-an-email', password: PASSWORD }).expect(400);
  });

  it('gives the same error for a wrong password and an unknown account', async () => {
    await signIn(app, 'known@test.dev');
    const wrong = await http.post('/api/auth/login').send({ email: 'known@test.dev', password: 'wrong password', client: 'web' }).expect(401);
    const unknown = await http.post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'wrong password', client: 'web' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('locks an account for 15 minutes after 10 wrong passwords', async () => {
    await signIn(app, 'locked@test.dev');
    for (let i = 0; i < 10; i++) {
      await http.post('/api/auth/login').send({ email: 'locked@test.dev', password: `guess ${i}`, client: 'web' }).expect(401);
    }
    await http.post('/api/auth/login').send({ email: 'locked@test.dev', password: PASSWORD, client: 'web' }).expect(429);
  });

  it('changing the password requires the current one and signs out other sessions', async () => {
    const a = await signIn(app, 'change@test.dev');
    const b = await signIn(app, 'change@test.dev', 'extension');
    await http.post('/api/auth/password').set(a.auth).send({ currentPassword: 'wrong', newPassword: 'brand new password' }).expect(401);
    await http.post('/api/auth/password').set(a.auth).send({ currentPassword: PASSWORD, newPassword: 'brand new password' }).expect(204);
    await http.get('/api/me').set(a.auth).expect(200);
    await http.get('/api/me').set(b.auth).expect(401);
    await http.post('/api/auth/login').send({ email: 'change@test.dev', password: PASSWORD, client: 'web' }).expect(401);
    await http.post('/api/auth/login').send({ email: 'change@test.dev', password: 'brand new password', client: 'web' }).expect(200);
  });

  it('refreshes web sessions from the cookie only with the client header', async () => {
    const web = await signIn(app, 'cookie@test.dev');
    await http.post('/api/auth/refresh').set('Cookie', web.cookie!).expect(401);
    const res = await http.post('/api/auth/refresh').set('Cookie', web.cookie!).set('X-DE92-Client', 'web').expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toContain('de92_rt=');
  });

  it('rotates extension refresh tokens and revokes the session when an old one is replayed', async () => {
    await signIn(app, 'rotate@test.dev'); // the extension can only sign in to existing accounts
    const ext = await signIn(app, 'rotate@test.dev', 'extension');
    const first = await http.post('/api/auth/refresh').send({ refreshToken: ext.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(ext.refreshToken);

    // Replay within the grace window (parallel refresh): allowed, no new refresh token.
    const again = await http.post('/api/auth/refresh').send({ refreshToken: ext.refreshToken }).expect(200);
    expect(again.body.refreshToken).toBeNull();

    // Replay after the grace window: treated as theft, session revoked.
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    await http.post('/api/auth/refresh').send({ refreshToken: ext.refreshToken }).expect(401);
    vi.restoreAllMocks();
    await http.post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
    await http.get('/api/me').set('Authorization', `Bearer ${first.body.accessToken}`).expect(401);
  });

  it('disconnecting a device cuts its access immediately', async () => {
    const web = await signIn(app, 'devices@test.dev');
    const ext = await signIn(app, 'devices@test.dev', 'extension');

    const list = (await http.get('/api/sessions').set(web.auth).expect(200)).body;
    expect(list).toHaveLength(2);
    expect(list.find((s: { current: boolean }) => s.current).id).toBe(web.sessionId);

    await http.delete(`/api/sessions/${ext.sessionId}`).set(web.auth).expect(204);
    await http.post('/api/sync').set(ext.auth).send({ items: [] }).expect(401);
    await http.post('/api/auth/refresh').send({ refreshToken: ext.refreshToken }).expect(401);
    await http.get('/api/me').set(web.auth).expect(200);
  });

  it('"sign out other sessions" keeps only the current one', async () => {
    const a = await signIn(app, 'others@test.dev');
    const b = await signIn(app, 'others@test.dev', 'extension');
    const c = await signIn(app, 'others@test.dev');
    expect((await http.post('/api/sessions/revoke-others').set(c.auth).expect(201)).body).toEqual({ revoked: 2 });
    await http.get('/api/me').set(a.auth).expect(401);
    await http.get('/api/me').set(b.auth).expect(401);
    await http.get('/api/me').set(c.auth).expect(200);
  });

  it('logout revokes the session', async () => {
    const web = await signIn(app, 'logout@test.dev');
    await http.post('/api/auth/logout').set(web.auth).expect(204);
    await http.get('/api/me').set(web.auth).expect(401);
  });

  it('streams live changes and closes the stream when the session is revoked', async () => {
    const web = await signIn(app, 'live@test.dev');
    const other = await signIn(app, 'live@test.dev');
    const server = app.getHttpServer();
    if (!server.listening) await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/api/events`, { headers: web.auth });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();

    await http.put('/api/days/5').set(other.auth).send({ done: true }).expect(200);
    let received = '';
    while (!received.includes('event: change')) received += new TextDecoder().decode((await reader.read()).value);
    expect(received).toMatch(/event: change\n(id: \d+\n)?data: \{"type":"day","day":5\}/);

    await http.delete(`/api/sessions/${web.sessionId}`).set(other.auth).expect(204);
    let done = false;
    while (!done) ({ done } = await reader.read()); // stream ends
    expect(done).toBe(true);
  });

  it('deleting the account removes the data and signs out every session', async () => {
    const web = await signIn(app, 'gone@test.dev');
    const ext = await signIn(app, 'gone@test.dev', 'extension');
    await http.put('/api/days/1').set(web.auth).send({ done: true }).expect(200);
    await http.delete('/api/me').set(web.auth).expect(204);
    await http.get('/api/me').set(web.auth).expect(401);
    await http.get('/api/me').set(ext.auth).expect(401);

    // Signing up again starts from scratch.
    const fresh = await signIn(app, 'gone@test.dev');
    expect((await http.get('/api/me').set(fresh.auth).expect(200)).body.days).toEqual([]);
  });
});

describe('rate limiting', () => {
  it('limits login attempts per client', async () => {
    const app = await testApp({ RATE_LIMIT: 'on' });
    const http = request(app.getHttpServer());
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await http.post('/api/auth/login').send({ email: `r${i}@test.dev`, password: 'whatever', client: 'web' })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
    await app.close();
  });
});
