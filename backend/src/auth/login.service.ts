import { ConflictException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DB, Db } from '../db/database';
import { authChallenges, users } from '../db/schema';
import { randomToken, safeEqual, sha256 } from '../common/crypto';
import { hashPassword, verifyPassword } from '../common/password';

const EXT_CODE_TTL_MS = 2 * 60_000;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
const MAX_FAILED_LOGINS = 10;
const INVALID_LOGIN = 'Incorrect email or password';

// Email + password accounts, plus OAuth state and the one-time codes the
// extension exchanges (with PKCE) after Google sign-in. Only hashes are stored.
@Injectable()
export class LoginService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async register(rawEmail: string, password: string): Promise<string> {
    const email = normalize(rawEmail);
    const passwordHash = await hashPassword(password);
    const [created] = await this.db
      .insert(users)
      .values({ email, displayName: email.split('@')[0].slice(0, 80), startDate: '2026-09-26', passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!created) throw new ConflictException('An account with this email already exists. Sign in instead.');
    return created.id;
  }

  async login(rawEmail: string, password: string): Promise<string> {
    const email = normalize(rawEmail);
    const [u] = await this.db
      .select({ id: users.id, passwordHash: users.passwordHash, lockedUntil: users.lockedUntil })
      .from(users)
      .where(eq(users.email, email));

    if (u?.lockedUntil && u.lockedUntil > new Date()) {
      await verifyPassword(password, null); // keep timing uniform
      throw new HttpException('Too many failed attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const ok = await verifyPassword(password, u?.passwordHash ?? null);
    if (!u || !ok) {
      if (u) {
        await this.db
          .update(users)
          .set({
            failedLogins: sql`${users.failedLogins} + 1`,
            lockedUntil: sql`case when ${users.failedLogins} + 1 >= ${MAX_FAILED_LOGINS} then now() + interval '15 minutes' else null end`,
          })
          .where(eq(users.id, u.id));
      }
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    await this.db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
    return u.id;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const [u] = await this.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
    // Accounts created with Google have no password yet and may set one directly.
    if (u?.passwordHash && !(await verifyPassword(currentPassword, u.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.db.update(users).set({ passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
  }

  async hasPassword(userId: string) {
    const [u] = await this.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
    return Boolean(u?.passwordHash);
  }

  async findOrCreateUser(email: string, displayName?: string | null) {
    const normalized = normalize(email);
    const [created] = await this.db
      .insert(users)
      .values({ email: normalized, displayName: (displayName ?? normalized.split('@')[0]).slice(0, 80), startDate: '2026-09-26' })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (created) return created.id;
    const [u] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, normalized));
    return u.id;
  }

  // --- OAuth state (Google) -------------------------------------------------

  async createOAuthState(payload: Record<string, string>) {
    const state = randomToken();
    await this.db.insert(authChallenges).values({
      kind: 'oauth_state', tokenHash: sha256(state), payload, expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    });
    return state;
  }

  async consumeOAuthState(state: string) {
    const [c] = await this.db
      .update(authChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(authChallenges.kind, 'oauth_state'), eq(authChallenges.tokenHash, sha256(state)), isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, new Date())))
      .returning({ payload: authChallenges.payload });
    return c?.payload ?? null;
  }

  // --- Extension auth codes (PKCE) ------------------------------------------

  async createExtensionCode(userId: string, codeChallenge: string) {
    const code = randomToken();
    await this.db.insert(authChallenges).values({
      kind: 'ext_code', userId, tokenHash: sha256(code), payload: { codeChallenge }, expiresAt: new Date(Date.now() + EXT_CODE_TTL_MS),
    });
    return code;
  }

  async redeemExtensionCode(code: string, codeVerifier: string): Promise<string> {
    const [c] = await this.db
      .update(authChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(authChallenges.kind, 'ext_code'), eq(authChallenges.tokenHash, sha256(code)), isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, new Date())))
      .returning({ userId: authChallenges.userId, payload: authChallenges.payload });
    if (!c?.userId || !safeEqual(sha256(codeVerifier), c.payload.codeChallenge ?? '')) throw new UnauthorizedException('Invalid or expired code');
    return c.userId;
  }
}

const normalize = (email: string) => email.trim().toLowerCase();
