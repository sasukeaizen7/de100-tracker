import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { signIn, testApp } from './helpers';

describe('data isolation and validation', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let alice: Awaited<ReturnType<typeof signIn>>;
  let bob: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    app = await testApp();
    http = request(app.getHttpServer());
    alice = await signIn(app, 'alice@test.dev');
    bob = await signIn(app, 'bob@test.dev');
    await http.put('/api/days/1').set(alice.auth).send({ done: true, notes: 'joins done' }).expect(200);
    await http.put('/api/progress/1').set(alice.auth).send({ percent: 30 }).expect(200);
  });
  afterAll(() => app.close());

  it('rejects requests without a valid token', async () => {
    await http.get('/api/me').expect(401);
    await http.get('/api/me').set('Authorization', 'Bearer not-a-token').expect(401);
  });

  it('rejects a token with a forged "none" algorithm', async () => {
    const [, payload] = alice.accessToken.split('.');
    const forged = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
    await http.get('/api/me').set('Authorization', `Bearer ${forged}`).expect(401);
  });

  it('returns only your own data', async () => {
    const a = (await http.get('/api/me').set(alice.auth).expect(200)).body;
    expect(a.profile.email).toBe('alice@test.dev');
    expect(a.days).toEqual([expect.objectContaining({ day: 1, done: true, notes: 'joins done' })]);
    expect(a.courses).toHaveLength(14);
    for (const c of a.courses) expect(c.udemyUrl).toMatch(/^https:\/\/www\.udemy\.com\/course\/[a-z0-9-]+\/$/); // direct links, not searches

    const b = (await http.get('/api/me').set(bob.auth).expect(200)).body;
    expect(b.profile.email).toBe('bob@test.dev');
    expect(b.days).toEqual([]);
    expect(b.progress).toEqual([]);
    expect(b.sessions.map((s: { id: string }) => s.id)).not.toContain(alice.sessionId);
  });

  it("does not let one user touch another user's sessions or data", async () => {
    await http.delete(`/api/sessions/${alice.sessionId}`).set(bob.auth).expect(404);
    await http.get('/api/me').set(alice.auth).expect(200); // Alice still signed in

    const exported = (await http.get('/api/me/export').set(bob.auth).expect(200)).body;
    expect(JSON.stringify(exported)).not.toContain('alice');
  });

  it('validates input', async () => {
    await http.put('/api/progress/1').set(alice.auth).send({ percent: 150 }).expect(400);
    await http.put('/api/progress/1').set(alice.auth).send({ percent: 12.5 }).expect(400);
    await http.put('/api/progress/999').set(alice.auth).send({ percent: 10 }).expect(404);
    await http.put('/api/days/100').set(alice.auth).send({ done: true }).expect(200); // last day of the program
    await http.put('/api/days/101').set(alice.auth).send({ done: true }).expect(400);
    await http.put('/api/days/0').set(alice.auth).send({ done: true }).expect(400);
    await http.put('/api/days/2').set(alice.auth).send({ notes: 'x'.repeat(2001) }).expect(400);
    await http.put('/api/days/2').set(alice.auth).send({ done: true, userId: bob.sessionId }).expect(400); // unknown fields rejected
    await http.patch('/api/me').set(alice.auth).send({ startDate: 'tomorrow' }).expect(400);
  });

  it('only lets the extension sync, and matches Udemy titles to plan courses', async () => {
    await http.post('/api/sync').set(alice.auth).send({ items: [] }).expect(403);

    const ext = await signIn(app, 'alice@test.dev', 'extension');
    expect(ext.refreshToken).toBeTruthy();
    expect(ext.cookie).toBeUndefined();

    const res = await http.post('/api/sync').set(ext.auth).send({
      items: [
        { udemyId: 1, title: 'The Complete SQL Bootcamp: Go from Zero to Hero', percent: 42 },
        { title: 'Italian cooking', percent: 90 },
      ],
    }).expect(200);
    expect(res.body).toEqual({ found: 2, matched: [{ courseId: 1, percent: 42, udemyTitle: 'The Complete SQL Bootcamp: Go from Zero to Hero' }] });

    const me = (await http.get('/api/me').set(alice.auth).expect(200)).body;
    expect(me.progress).toEqual([expect.objectContaining({ courseId: 1, percent: 42, source: 'extension' })]);

    await http.post('/api/sync').set(ext.auth).send({ items: [{ title: 'x', percent: 120 }] }).expect(400);
    await http.post('/api/sync').set(ext.auth).send({ items: 'nope' }).expect(400);
  });
});
