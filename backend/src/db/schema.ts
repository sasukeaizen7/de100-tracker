// Drizzle mirror of migrations/*.sql (the SQL files are the source of truth).
import { bigint, boolean, customType, date, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  passwordHash: text('password_hash'),
  failedLogins: smallint('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  kind: text('kind', { enum: ['web', 'extension'] }).notNull(),
  name: text('name').notNull(),
  refreshHash: text('refresh_hash').notNull(),
  prevRefreshHash: text('prev_refresh_hash'),
  rotatedAt: ts('rotated_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
});

export const authChallenges = pgTable('auth_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['oauth_state', 'ext_code'] }).notNull(),
  email: text('email'),
  userId: uuid('user_id'),
  codeHash: text('code_hash'),
  tokenHash: text('token_hash'),
  payload: jsonb('payload').$type<Record<string, string>>().notNull().default({}),
  attempts: smallint('attempts').notNull().default(0),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const courses = pgTable('courses', {
  id: smallint('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  instructor: text('instructor'),
  udemyUrl: text('udemy_url').notNull(),
  udemyCourseId: bigint('udemy_course_id', { mode: 'number' }),
  keywords: text('keywords').array().notNull(),
  startDay: smallint('start_day').notNull(),
  endDay: smallint('end_day').notNull(),
});

export const courseProgress = pgTable('course_progress', {
  userId: uuid('user_id').notNull(),
  courseId: smallint('course_id').notNull(),
  percent: smallint('percent').notNull(),
  source: text('source', { enum: ['manual', 'extension'] }).notNull(),
  syncedAt: ts('synced_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.courseId] })]);

export const dayLog = pgTable('day_log', {
  userId: uuid('user_id').notNull(),
  day: smallint('day').notNull(),
  done: boolean('done').notNull().default(false),
  notes: text('notes').notNull().default(''),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

export interface NoteDoc {
  type: 'doc';
  content?: unknown[];
}

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  parentId: uuid('parent_id'),
  title: text('title').notNull().default(''),
  icon: text('icon').notNull().default(''),
  content: jsonb('content').$type<NoteDoc>().notNull(),
  position: integer('position').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const noteImages = pgTable('note_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});
