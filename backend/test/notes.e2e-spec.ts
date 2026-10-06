import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { signIn, testApp } from './helpers';

// Smallest valid PNG (1x1 transparent pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('notes', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let alice: Awaited<ReturnType<typeof signIn>>;
  let bob: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    app = await testApp();
    http = request(app.getHttpServer());
    alice = await signIn(app, 'alice-notes@test.dev');
    bob = await signIn(app, 'bob-notes@test.dev');
  });
  afterAll(() => app.close());

  it('creates, saves and reloads a rich note with colors, sizes and math', async () => {
    const note = (await http.post('/api/notes').set(alice.auth).send({ title: 'SQL window functions' }).expect(201)).body;
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Important', marks: [{ type: 'textStyle', attrs: { color: '#e03e3e', fontSize: '24px' } }] }] },
        { type: 'blockMath', attrs: { latex: '\\sum_{i=1}^{n} x_i' } },
      ],
    };
    await http.put(`/api/notes/${note.id}`).set(alice.auth).send({ content, icon: '📘' }).expect(200);
    const saved = (await http.get(`/api/notes/${note.id}`).set(alice.auth).expect(200)).body;
    expect(saved).toMatchObject({ title: 'SQL window functions', icon: '📘', content });
    expect(saved.userId).toBeUndefined();
  });

  it("keeps each user's notes private", async () => {
    const note = (await http.post('/api/notes').set(alice.auth).send({ title: 'Private' }).expect(201)).body;
    expect((await http.get('/api/notes').set(bob.auth).expect(200)).body).toEqual([]);
    await http.get(`/api/notes/${note.id}`).set(bob.auth).expect(404);
    await http.put(`/api/notes/${note.id}`).set(bob.auth).send({ title: 'hacked' }).expect(404);
    await http.delete(`/api/notes/${note.id}`).set(bob.auth).expect(404);
    await http.post('/api/notes').set(bob.auth).send({ parentId: note.id }).expect(404); // can't nest under someone else's page
    expect((await http.get(`/api/notes/${note.id}`).set(alice.auth).expect(200)).body.title).toBe('Private');
  });

  it('rejects unsafe content', async () => {
    const note = (await http.post('/api/notes').set(alice.auth).send({}).expect(201)).body;
    const bad = (content: unknown) => http.put(`/api/notes/${note.id}`).set(alice.auth).send({ content }).expect(400);
    await bad({ type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil.example' } }] });
    await bad({ type: 'doc', content: [{ type: 'image', attrs: { src: 'https://tracker.example/pixel.gif' } }] });
    await bad('not an object');
  });

  it('uploads images, checks their real type, and serves them only with a valid signature', async () => {
    const up = (await http.post('/api/notes/images').set(alice.auth).attach('file', PNG, 'pixel.png').expect(201)).body;
    expect(up.url).toMatch(/^\/api\/images\/[0-9a-f-]{36}\?sig=[A-Za-z0-9_-]{43}$/);

    const img = await http.get(up.url).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['content-security-policy']).toContain('sandbox');
    expect(Buffer.compare(img.body, PNG)).toBe(0);

    await http.get(`/api/images/${up.id}`).expect(404); // no signature
    await http.get(`/api/images/${up.id}?sig=${'A'.repeat(43)}`).expect(404); // forged signature

    // An SVG renamed to .png, or any non-image, is refused by its bytes.
    await http.post('/api/notes/images').set(alice.auth).attach('file', SVG, { filename: 'evil.png', contentType: 'image/png' }).expect(400);
    await http.post('/api/notes/images').attach('file', PNG, 'pixel.png').expect(401);

    // The uploaded image can be placed in a note.
    const note = (await http.post('/api/notes').set(alice.auth).send({}).expect(201)).body;
    await http.put(`/api/notes/${note.id}`).set(alice.auth).send({ content: { type: 'doc', content: [{ type: 'image', attrs: { src: up.url, alt: 'pixel' } }] } }).expect(200);
  });

  it('rejects images over 4 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1)]);
    const res = await http.post('/api/notes/images').set(alice.auth).attach('file', big, 'big.png');
    expect(res.status).toBe(413);
  });

  it('nests sub-pages, prevents cycles, and deletes sub-pages with their parent', async () => {
    const parent = (await http.post('/api/notes').set(alice.auth).send({ title: 'Week 1' }).expect(201)).body;
    const child = (await http.post('/api/notes').set(alice.auth).send({ title: 'Day 1', parentId: parent.id }).expect(201)).body;
    expect(child.parentId).toBe(parent.id);
    await http.patch(`/api/notes/${parent.id}/move`).set(alice.auth).send({ parentId: child.id, position: 0 }).expect(400);
    await http.delete(`/api/notes/${parent.id}`).set(alice.auth).expect(204);
    await http.get(`/api/notes/${child.id}`).set(alice.auth).expect(404);
  });

  it('includes notes in the data export and deletes them with the account', async () => {
    const carol = await signIn(app, 'carol-notes@test.dev');
    await http.post('/api/notes').set(carol.auth).send({ title: 'Mine' }).expect(201);
    const up = (await http.post('/api/notes/images').set(carol.auth).attach('file', PNG, 'p.png').expect(201)).body;
    const exported = (await http.get('/api/me/export').set(carol.auth).expect(200)).body;
    expect(exported.notes.map((n: { title: string }) => n.title)).toEqual(['Mine']);
    expect(exported.noteImages).toHaveLength(1);

    await http.delete('/api/me').set(carol.auth).expect(204);
    await http.get(up.url).expect(404); // image gone too
  });
});
