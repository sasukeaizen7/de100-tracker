import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AppConfig, CONFIG } from '../config';
import { deviceLabel } from '../common/crypto';
import { AuthGuard, CurrentUser } from './auth.guard';
import { ChangePasswordDto, ExtensionTokenDto, GoogleStartQuery, LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { GoogleService } from './google.service';
import { LoginService } from './login.service';
import { AuthUser, IssuedTokens, SessionKind, TokensService } from './tokens.service';

export const REFRESH_COOKIE = 'de92_rt';
export const CLIENT_HEADER = 'x-de92-client';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly login: LoginService,
    private readonly tokens: TokensService,
    private readonly google: GoogleService,
  ) {}

  @Get('providers')
  providers() {
    return { password: true, google: this.google.enabled };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = await this.login.register(dto.email, dto.password);
    return this.startSession(userId, 'web', undefined, req, res);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signIn(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = await this.login.login(dto.email, dto.password);
    return this.startSession(userId, dto.client, dto.deviceName, req, res);
  }

  // Changing the password signs out every other session.
  @Post('password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AuthGuard)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.login.changePassword(user.userId, dto.currentPassword ?? '', dto.newPassword);
    await this.tokens.revokeOthers(user.userId, user.sessionId);
  }

  // Web: refresh token in an httpOnly cookie (plus a custom header against CSRF).
  // Extension: refresh token in the body.
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshDto, @Headers(CLIENT_HEADER) client: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromCookie = !dto.refreshToken;
    if (fromCookie && client !== 'web') throw new UnauthorizedException();
    const token = dto.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    const issued = token ? await this.tokens.refresh(token) : null;
    if (!issued) {
      if (fromCookie) res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw new UnauthorizedException('Session expired');
    }
    return this.respond(issued, fromCookie ? 'web' : 'extension', res);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.tokens.revoke(user.userId, user.sessionId);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  // --- Google -------------------------------------------------------------

  @Get('google/start')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async googleStart(@Query() q: GoogleStartQuery, @Res() res: Response) {
    if (!this.google.enabled) throw new BadRequestException('Google sign-in is not configured');
    const payload: Record<string, string> = { client: q.client };
    if (q.client === 'extension') {
      if (!q.redirect_uri || !this.allowedExtensionRedirect(q.redirect_uri) || !q.code_challenge) {
        throw new BadRequestException('Unknown extension redirect or missing code_challenge');
      }
      payload.redirectUri = q.redirect_uri;
      payload.codeChallenge = q.code_challenge;
    }
    res.redirect(this.google.authorizeUrl(await this.login.createOAuthState(payload)));
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const payload = typeof state === 'string' ? await this.login.consumeOAuthState(state) : null;
    if (!payload) return res.redirect(`${this.config.webOrigin}/#/login?error=expired`);
    const fail = (reason: string) =>
      res.redirect(payload.client === 'extension' ? `${payload.redirectUri}?error=${reason}` : `${this.config.webOrigin}/#/login?error=${reason}`);
    if (typeof code !== 'string') return fail('cancelled');

    try {
      const identity = await this.google.exchange(code);
      const userId = await this.login.findOrCreateUser(identity.email, identity.name);
      if (payload.client === 'extension') {
        const extCode = await this.login.createExtensionCode(userId, payload.codeChallenge);
        return res.redirect(`${payload.redirectUri}?code=${extCode}`);
      }
      const issued = await this.tokens.createSession(userId, 'web', deviceLabel(req.headers['user-agent'], 'Web browser'));
      res.cookie(REFRESH_COOKIE, issued.refreshToken!, this.cookieOptions());
      return res.redirect(`${this.config.webOrigin}/#/`);
    } catch {
      return fail('google_failed');
    }
  }

  // Extension exchanges the one-time code from the Google redirect, proving it started the flow (PKCE).
  @Post('token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async extensionToken(@Body() dto: ExtensionTokenDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = await this.login.redeemExtensionCode(dto.code, dto.codeVerifier);
    return this.startSession(userId, 'extension', dto.deviceName, req, res);
  }

  // --- helpers --------------------------------------------------------------

  private async startSession(userId: string, kind: SessionKind, deviceName: string | undefined, req: Request, res: Response) {
    const name = deviceName ?? deviceLabel(req.headers['user-agent'], kind === 'web' ? 'Web browser' : 'Chrome extension');
    return this.respond(await this.tokens.createSession(userId, kind, name), kind, res);
  }

  private respond(issued: IssuedTokens, kind: SessionKind, res: Response) {
    const body = { accessToken: issued.accessToken, expiresIn: issued.expiresIn, sessionId: issued.sessionId };
    if (kind === 'extension') return { ...body, refreshToken: issued.refreshToken };
    if (issued.refreshToken) res.cookie(REFRESH_COOKIE, issued.refreshToken, this.cookieOptions());
    return body;
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.production, sameSite: 'strict', path: '/api/auth', maxAge: 30 * 86_400_000 };
  }

  private allowedExtensionRedirect(uri: string) {
    return this.config.extensionIds.some((id) => uri === `https://${id}.chromiumapp.org/auth`);
  }
}
