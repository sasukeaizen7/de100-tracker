import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import type { AppConfig } from '../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export const DB = Symbol('DB');

export interface Database {
  db: Db;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = resolve(__dirname, '../../migrations');
const log = new Logger('Database');

// Real PostgreSQL when DATABASE_URL is set; otherwise an embedded PGlite
// (Postgres compiled to WebAssembly) so the API runs without Docker.
export async function openDatabase(config: AppConfig): Promise<Database> {
  let database: Database;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
    database = {
      db: drizzlePg(pool, { schema }),
      exec: async (sql) => { await pool.query(sql); },
      close: () => pool.end(),
    };
    log.log('Using PostgreSQL');
  } else {
    if (config.pgliteDir) mkdirSync(config.pgliteDir, { recursive: true });
    const client = new PGlite(config.pgliteDir ?? undefined);
    database = {
      db: drizzlePglite(client, { schema }) as unknown as Db,
      exec: async (sql) => { await client.exec(sql); },
      close: () => client.close(),
    };
    log.log(`Using embedded PGlite (${config.pgliteDir ?? 'in memory'})`);
  }
  await migrate(database);
  return database;
}

async function migrate({ db, exec }: Database) {
  await exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set(
    ((await db.execute('select name from schema_migrations')) as unknown as { rows: { name: string }[] }).rows.map((r) => r.name),
  );
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await exec(`begin;\n${sql}\ninsert into schema_migrations (name) values ('${file.replace(/'/g, "''")}');\ncommit;`);
    log.log(`Applied migration ${file}`);
  }
}
