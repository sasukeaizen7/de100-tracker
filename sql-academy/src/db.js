import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import setupSql from './data/setup.sql?raw';
import { splitSql, stripComments } from './sqlsplit';

// One in-memory PostgreSQL (WASM) for the whole app, created on first use.
let dbPromise = null;

function create() {
  return PGlite.create({ extensions: { pg_trgm } }).then(async (db) => {
    await db.exec("set timezone = 'Europe/Paris'");
    await db.exec(setupSql);
    return db;
  });
}

export function getDb() {
  if (!dbPromise) dbPromise = create();
  return dbPromise;
}

// Throws the database away and rebuilds the practice data from setup.sql.
export async function resetDb() {
  const old = dbPromise;
  dbPromise = null;
  if (old) {
    try { (await old).close(); } catch { /* already closed */ }
  }
  return getDb();
}

// Statements that change the schema or data, so the UI can mention "Reset data".
const WRITES = /\b(insert|update|delete|merge|create|alter|drop|truncate|call)\b/i;

// Runs a script statement by statement, like psql: each statement autocommits unless an
// explicit BEGIN is open (sending the whole string at once would make it one implicit
// transaction, so a ROLLBACK would also undo the statements before BEGIN).
// Stops at the first error. Returns every result set that has columns, plus notices.
export async function run(sql) {
  const db = await getDb();
  const notices = [];
  const sets = [];
  let affected = 0;
  const started = performance.now();
  const statements = splitSql(sql);
  for (let i = 0; i < statements.length; i++) {
    try {
      const [r] = await db.exec(statements[i], { onNotice: (n) => notices.push(n.message) });
      if (r?.fields.length) {
        sets.push({ columns: r.fields.map((f) => f.name), rows: r.rows.map((row) => r.fields.map((f) => row[f.name])) });
      }
      affected += r?.affectedRows ?? 0;
    } catch (e) {
      // A failed statement inside BEGIN leaves the session in an aborted transaction.
      try { await db.exec('rollback'); } catch { /* no transaction open */ }
      return {
        ok: false,
        error: e.message,
        detail: e.detail,
        hint: e.hint,
        statement: statements.length > 1 ? i + 1 : null,
        sets,
        notices,
        ms: Math.round(performance.now() - started),
      };
    }
  }
  return {
    ok: true,
    sets,
    notices,
    affected,
    ms: Math.round(performance.now() - started),
    wrote: WRITES.test(stripComments(sql)),
  };
}

// Compares the last result set of two queries. Row order matters only when `ordered`.
export async function compare(userSql, solutionSql, { ordered = false } = {}) {
  const db = await getDb();
  const lastSet = async (sql) => {
    await db.exec('begin');
    try {
      let set = null;
      for (const stmt of splitSql(sql)) {
        const [r] = await db.exec(stmt);
        if (r?.fields.length) set = r;
      }
      return set ? set.rows.map((row) => set.fields.map((f) => normalize(row[f.name]))) : [];
    } finally {
      try { await db.exec('rollback'); } catch { /* the query already ended it */ } // exercises never change the shared data
    }
  };
  let mine;
  try {
    mine = await lastSet(userSql);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const expected = await lastSet(solutionSql);
  const key = (rows) => rows.map((r) => JSON.stringify(r));
  const a = key(mine), b = key(expected);
  if (!ordered) { a.sort(); b.sort(); }
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  return { ok: true, same, got: mine.length, want: expected.length };
}

function normalize(v) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return Number(v.toFixed(6));
  if (typeof v === 'string' && /^-?\d+\.\d+$/.test(v)) return Number(Number(v).toFixed(6));
  if (typeof v === 'bigint') return Number(v);
  return v;
}
