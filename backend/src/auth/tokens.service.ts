import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { DB, Db } from '../db/database';
import { sessions } from '../db/schema';
import { randomToken, safeEqual, sha256, signJwt, verifyJwt } from '../common/crypto';
import { EventsService } from '../events/events.service';

export type SessionKind = 'web' | 'extension';

export interface AuthUser {
  userId: string;
  sessionId: string;
  kind: SessionKind;
}

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null; // null when an in-flight rotation already issued one
  sessionId: string;
}

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS: Record<SessionKind, number> = { web: 30 * 86_400_000, extension: 90 * 86_400_000 };
const ROTATION_GRACE_MS = 30_000; // concurrent tabs refreshing at once shouldn't log the user out

@Injectable()
export class TokensService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly events: EventsService,
  ) {}

  async createSession(userId: string, kind: SessionKind, name: string): Promise<IssuedTokens> {
    const secret = randomToken();
    const [session] = await this.db
      .insert(sessions)
      .values({ userId, kind, name: name.slice(0, 60) || 'Unknown device', refreshHash: sha256(secret), expiresAt: new Date(Date.now() + REFRESH_TTL_MS[kind]) })
      .returning({ id: sessions.id });
    this.events.emit(userId, { type: 'sessions' });
    return this.issue(userId, session.id, kind, `${session.id}.${secret}`);
  }

  // Rotates the refresh token. Reusing an old token (outside the grace window) revokes the session.
  async refresh(refreshToken: string): Promise<IssuedTokens | null> {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) return null;

    const [s] = await this.db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
    const hash = sha256(secret);

    if (safeEqual(hash, s.refreshHash)) {
      const next = randomToken();
      const [rotated] = await this.db
        .update(sessions)
        .set({
          refreshHash: sha256(next), prevRefreshHash: s.refreshHash, rotatedAt: new Date(), lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS[s.kind]),
        })
        .where(and(eq(sessions.id, s.id), eq(sessions.refreshHash, s.refreshHash)))
        .returning({ id: sessions.id });
      if (rotated) return this.issue(s.userId, s.id, s.kind, `${s.id}.${next}`);
      return this.issue(s.userId, s.id, s.kind, null); // lost a race with a parallel refresh
    }

    if (s.prevRefreshHash && safeEqual(hash, s.prevRefreshHash) && s.rotatedAt && Date.now() - s.rotatedAt.getTime() < ROTATION_GRACE_MS) {
      return this.issue(s.userId, s.id, s.kind, null);
    }

    await this.revoke(s.userId, s.id); // token reuse: assume theft
    return null;
  }

  async verifyAccess(token: string): Promise<AuthUser | null> {
    const claims = verifyJwt<{ sub: string; sid: string; knd: SessionKind }>(token, this.config.jwtSecret);
    if (!claims) return null;
    const [s] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, claims.sid), eq(sessions.userId, claims.sub), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
    return s ? { userId: claims.sub, sessionId: claims.sid, kind: claims.knd } : null;
  }

  async revoke(userId: string, sessionId: string) {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    if (rows.length) {
      this.events.closeSession(userId, sessionId);
      this.events.emit(userId, { type: 'sessions' });
    }
    return rows.length > 0;
  }

  async revokeOthers(userId: string, keepSessionId: string) {
    const rows = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    rows.forEach((r) => this.events.closeSession(userId, r.id));
    if (rows.length) this.events.emit(userId, { type: 'sessions' });
    return rows.length;
  }

  touch(sessionId: string) {
    return this.db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  private issue(userId: string, sessionId: string, kind: SessionKind, refreshToken: string | null): IssuedTokens {
    return {
      accessToken: signJwt({ sub: userId, sid: sessionId, knd: kind }, this.config.jwtSecret, ACCESS_TTL_S),
      expiresIn: ACCESS_TTL_S,
      refreshToken,
      sessionId,
    };
  }
}
