import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { DB, Db } from '../db/database';
import { courseProgress, courses, dayLog, noteImages, notes, sessions, users } from '../db/schema';
import { EventsService } from '../events/events.service';
import { matchCourses } from './match';
import { SaveDayDto, SyncItemDto, UpdateProfileDto } from './tracker.dto';

// Every query here is scoped by the authenticated user's id: that scoping is
// what keeps one user's data invisible to another (see test/isolation.e2e-spec.ts).
@Injectable()
export class TrackerService {
  constructor(@Inject(DB) private readonly db: Db, private readonly events: EventsService) {}

  async snapshot(userId: string, currentSessionId: string) {
    const [profile, courseRows, progress, days, sessionRows] = await Promise.all([
      this.profile(userId),
      this.courses(),
      this.db.select().from(courseProgress).where(eq(courseProgress.userId, userId)),
      this.db.select().from(dayLog).where(eq(dayLog.userId, userId)),
      this.sessions(userId, currentSessionId),
    ]);
    return {
      profile,
      courses: courseRows,
      progress: progress.map(({ userId: _u, ...p }) => p),
      days: days.map(({ userId: _u, ...d }) => d),
      sessions: sessionRows,
    };
  }

  async profile(userId: string) {
    const [u] = await this.db
      .select({
        id: users.id, email: users.email, displayName: users.displayName, startDate: users.startDate, createdAt: users.createdAt,
        hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!u) throw new NotFoundException();
    return u;
  }

  courses() {
    return this.db.select().from(courses).orderBy(asc(courses.startDay), asc(courses.id));
  }

  async sessions(userId: string, currentSessionId: string) {
    const rows = await this.db
      .select({ id: sessions.id, kind: sessions.kind, name: sessions.name, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt));
    return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.startDate && Number.isNaN(Date.parse(`${dto.startDate}T00:00:00Z`))) throw new BadRequestException('startDate is not a valid date');
    const patch = {
      ...(dto.displayName !== undefined && { displayName: dto.displayName?.trim() || null }),
      ...(dto.startDate !== undefined && { startDate: dto.startDate }),
    };
    if (Object.keys(patch).length) await this.db.update(users).set(patch).where(eq(users.id, userId));
    this.events.emit(userId, { type: 'profile' });
    return this.profile(userId);
  }

  async saveDay(userId: string, day: number, dto: SaveDayDto) {
    if (!Number.isInteger(day) || day < 1 || day > 100) throw new BadRequestException('day must be between 1 and 100');
    if (dto.done === undefined && dto.notes === undefined) throw new BadRequestException('Nothing to update');
    const [row] = await this.db
      .insert(dayLog)
      .values({ userId, day, done: dto.done ?? false, notes: dto.notes ?? '' })
      .onConflictDoUpdate({
        target: [dayLog.userId, dayLog.day],
        set: { ...(dto.done !== undefined && { done: dto.done }), ...(dto.notes !== undefined && { notes: dto.notes }), updatedAt: sql`now()` },
      })
      .returning();
    this.events.emit(userId, { type: 'day', day });
    const { userId: _u, ...rest } = row;
    return rest;
  }

  async saveProgress(userId: string, courseId: number, percent: number, source: 'manual' | 'extension' = 'manual') {
    const [course] = await this.db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId));
    if (!course) throw new NotFoundException('Unknown course');
    const [row] = await this.db
      .insert(courseProgress)
      .values({ userId, courseId, percent, source })
      .onConflictDoUpdate({ target: [courseProgress.userId, courseProgress.courseId], set: { percent, source, syncedAt: sql`now()` } })
      .returning();
    this.events.emit(userId, { type: 'progress', courseId });
    const { userId: _u, ...rest } = row;
    return rest;
  }

  async sync(userId: string, items: SyncItemDto[]) {
    const matches = matchCourses(await this.courses(), items);
    for (const m of matches) await this.saveProgress(userId, m.courseId, m.percent, 'extension');
    return { found: items.length, matched: matches };
  }

  async exportData(userId: string) {
    const [profile, progress, days, sessionRows, noteRows, imageRows] = await Promise.all([
      this.profile(userId),
      this.db.select().from(courseProgress).where(eq(courseProgress.userId, userId)),
      this.db.select().from(dayLog).where(eq(dayLog.userId, userId)),
      this.db
        .select({ id: sessions.id, kind: sessions.kind, name: sessions.name, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, revokedAt: sessions.revokedAt })
        .from(sessions)
        .where(eq(sessions.userId, userId)),
      this.db
        .select({ id: notes.id, parentId: notes.parentId, title: notes.title, icon: notes.icon, content: notes.content, createdAt: notes.createdAt, updatedAt: notes.updatedAt })
        .from(notes)
        .where(eq(notes.userId, userId)),
      this.db
        .select({ id: noteImages.id, mime: noteImages.mime, size: noteImages.size, createdAt: noteImages.createdAt })
        .from(noteImages)
        .where(eq(noteImages.userId, userId)),
    ]);
    return {
      exportedAt: new Date().toISOString(), profile, courseProgress: progress, dayLog: days, sessions: sessionRows,
      notes: noteRows, noteImages: imageRows,
    };
  }

  // Cascades to sessions, progress, day log and pending sign-in codes.
  async deleteAccount(userId: string) {
    await this.db.delete(users).where(eq(users.id, userId));
    this.events.emit(userId, { type: 'account-deleted' });
    this.events.closeUser(userId);
  }
}
