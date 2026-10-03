import { BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { DB, Db } from '../db/database';
import { noteImages } from '../db/schema';
import { hmac, safeEqual } from '../common/crypto';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const QUOTA_BYTES = 200 * 1024 * 1024;

// Detect the real type from the file's bytes, never from the filename or the
// client's Content-Type. SVG is deliberately unsupported (it can carry scripts).
export function sniffImage(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class ImagesService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(CONFIG) private readonly config: AppConfig) {}

  // Image URLs carry an HMAC so <img> tags work without an auth header,
  // while ids can't be enumerated or forged.
  url(id: string) {
    return `/api/images/${id}?sig=${this.sign(id)}`;
  }

  private sign(id: string) {
    return hmac(this.config.jwtSecret, `note-image:${id}`);
  }

  async upload(userId: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('No image received');
    if (file.size > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Images can be at most 5 MB');
    const mime = sniffImage(file.buffer);
    if (!mime) throw new BadRequestException('Only PNG, JPEG, GIF and WebP images are supported');

    const [{ used }] = await this.db
      .select({ used: sql<number>`coalesce(sum(${noteImages.size}), 0)::bigint` })
      .from(noteImages)
      .where(eq(noteImages.userId, userId));
    if (Number(used) + file.size > QUOTA_BYTES) throw new PayloadTooLargeException('Image storage is full (200 MB)');

    const [row] = await this.db
      .insert(noteImages)
      .values({ userId, mime, size: file.size, data: file.buffer })
      .returning({ id: noteImages.id });
    return { id: row.id, url: this.url(row.id) };
  }

  async read(id: string, sig: string | undefined) {
    if (!/^[0-9a-f-]{36}$/.test(id) || typeof sig !== 'string' || !safeEqual(sig, this.sign(id))) throw new NotFoundException();
    const [img] = await this.db.select({ mime: noteImages.mime, data: noteImages.data }).from(noteImages).where(eq(noteImages.id, id));
    if (!img) throw new NotFoundException();
    return img;
  }

  async usage(userId: string) {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${noteImages.size}), 0)::bigint` })
      .from(noteImages)
      .where(and(eq(noteImages.userId, userId)));
    return { count: r.count, bytes: Number(r.bytes), quotaBytes: QUOTA_BYTES };
  }
}
