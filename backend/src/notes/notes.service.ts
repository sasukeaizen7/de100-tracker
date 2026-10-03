import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { DB, Db } from '../db/database';
import { notes } from '../db/schema';
import { EventsService } from '../events/events.service';
import { sanitizeNoteContent } from './note-content';
import { CreateNoteDto, MoveNoteDto, UpdateNoteDto } from './notes.dto';

const MAX_NOTES = 2000;
const EMPTY_DOC = { type: 'doc' as const, content: [{ type: 'paragraph' }] };

// Like the tracker, every query is scoped to the signed-in user.
@Injectable()
export class NotesService {
  constructor(@Inject(DB) private readonly db: Db, private readonly events: EventsService) {}

  list(userId: string) {
    return this.db
      .select({ id: notes.id, parentId: notes.parentId, title: notes.title, icon: notes.icon, position: notes.position, updatedAt: notes.updatedAt })
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(asc(notes.position), asc(notes.createdAt));
  }

  async get(userId: string, id: string) {
    const [note] = await this.db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    if (!note) throw new NotFoundException('Note not found');
    const { userId: _u, ...rest } = note;
    return rest;
  }

  async create(userId: string, dto: CreateNoteDto) {
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(notes).where(eq(notes.userId, userId));
    if (n >= MAX_NOTES) throw new HttpException(`You can have at most ${MAX_NOTES} notes`, HttpStatus.PAYLOAD_TOO_LARGE);
    if (dto.parentId) await this.assertOwned(userId, dto.parentId);

    const parent = dto.parentId ? eq(notes.parentId, dto.parentId) : isNull(notes.parentId);
    const [{ next }] = await this.db
      .select({ next: sql<number>`coalesce(max(${notes.position}) + 1, 0)::int` })
      .from(notes)
      .where(and(eq(notes.userId, userId), parent));

    const [note] = await this.db
      .insert(notes)
      .values({ userId, parentId: dto.parentId ?? null, title: dto.title ?? '', content: EMPTY_DOC, position: next })
      .returning();
    this.events.emit(userId, { type: 'notes', id: note.id });
    const { userId: _u, ...rest } = note;
    return rest;
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    const patch = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.content !== undefined && { content: sanitizeNoteContent(dto.content) }),
    };
    if (!Object.keys(patch).length) throw new BadRequestException('Nothing to update');
    const [row] = await this.db
      .update(notes)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning({ id: notes.id, updatedAt: notes.updatedAt });
    if (!row) throw new NotFoundException('Note not found');
    this.events.emit(userId, { type: 'notes', id });
    return row;
  }

  async move(userId: string, id: string, dto: MoveNoteDto) {
    await this.assertOwned(userId, id);
    if (dto.parentId) {
      await this.assertOwned(userId, dto.parentId);
      // A page can't be moved inside itself or one of its own sub-pages.
      const { rows } = (await this.db.execute(sql`
        with recursive up as (
          select id, parent_id from notes where id = ${dto.parentId} and user_id = ${userId}
          union all
          select n.id, n.parent_id from notes n join up on n.id = up.parent_id where n.user_id = ${userId}
        )
        select 1 from up where id = ${id} limit 1`)) as unknown as { rows: unknown[] };
      if (rows.length) throw new BadRequestException("A page can't be moved inside itself");
    }
    await this.db.update(notes).set({ parentId: dto.parentId, position: dto.position }).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    this.events.emit(userId, { type: 'notes', id });
    return { ok: true };
  }

  // Deletes the page and, through the foreign key, all of its sub-pages.
  async remove(userId: string, id: string) {
    const rows = await this.db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
    if (!rows.length) throw new NotFoundException('Note not found');
    this.events.emit(userId, { type: 'notes', id });
  }

  private async assertOwned(userId: string, id: string) {
    const [n] = await this.db.select({ id: notes.id }).from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    if (!n) throw new NotFoundException('Note not found');
  }
}
