import { describe, expect, it } from 'vitest';
import { compare, resetDb, run } from '../db';
import { chapters, conceptById, concepts } from './index';

describe('content structure', () => {
  it('has unique ids and valid related links', () => {
    expect(new Set(concepts.map((c) => c.id)).size).toBe(concepts.length);
    for (const c of concepts) {
      for (const r of c.related ?? []) expect(conceptById[r], `${c.id} → ${r}`).toBeDefined();
    }
  });

  it('links in text point to existing concepts', () => {
    const text = JSON.stringify(chapters.map((ch) => ch.concepts));
    for (const [, id] of text.matchAll(/\(#\/c\/([a-z0-9-]+)\)/g)) expect(conceptById[id], id).toBeDefined();
  });
});

// Every concept page on a fresh database, the way a learner meets it.
describe.each(concepts.map((c) => [c.id, c]))('%s', (_id, concept) => {
  it('examples run and exercise solutions are accepted', async () => {
    await resetDb();
    const examples = concept.body.filter((b) => b.sql && b.run !== false);
    const practice = concept.practice ?? [];

    // Exercises that don't depend on the page's examples must work on fresh data.
    for (const p of practice.filter((p) => !p.setup)) {
      const res = await run(`begin;\n${p.solution}\n;rollback;`);
      expect(res.ok, `${concept.id} solution: ${res.error}`).toBe(true);
    }

    for (const b of examples) {
      const res = await run(b.sql);
      if (b.expectError) expect(res.ok, `${concept.id} / ${b.title} should fail`).toBe(false);
      else expect(res.ok, `${concept.id} / ${b.title}: ${res.error}`).toBe(true);
    }

    // Learners click Run again: a second pass must behave like the first.
    for (const b of examples.filter((b) => b.rerun !== false)) {
      const res = await run(b.sql);
      if (b.expectError) expect(res.ok, `${concept.id} / ${b.title} should fail on rerun`).toBe(false);
      else expect(res.ok, `${concept.id} / ${b.title} on rerun: ${res.error}`).toBe(true);
    }

    for (const p of practice) {
      const self = await compare(p.solution, p.solution, { ordered: p.ordered });
      expect(self.ok && self.same, `${concept.id} solution compares equal to itself: ${self.error}`).toBe(true);
      const wrong = await compare('select 1 as wrong where false', p.solution, { ordered: p.ordered });
      expect(wrong.same, `${concept.id}: an empty answer must not pass`).toBe(wrong.want === 0);
    }
  }, 60000);
});
