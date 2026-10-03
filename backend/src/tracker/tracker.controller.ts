import {
  Body, Controller, Delete, ForbiddenException, Get, HttpCode, MessageEvent, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Res, Sse, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { endWith, finalize, ignoreElements, interval, map, merge, Observable, takeUntil } from 'rxjs';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { REFRESH_COOKIE } from '../auth/auth.controller';
import { AuthUser, TokensService } from '../auth/tokens.service';
import { EventsService } from '../events/events.service';
import { SaveDayDto, SaveProgressDto, SyncDto, UpdateProfileDto } from './tracker.dto';
import { TrackerService } from './tracker.service';

@Controller()
@UseGuards(AuthGuard)
export class TrackerController {
  constructor(
    private readonly tracker: TrackerService,
    private readonly tokens: TokensService,
    private readonly events: EventsService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.tracker.snapshot(user.userId, user.sessionId);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.tracker.updateProfile(user.userId, dto);
  }

  @Get('me/export')
  exportData(@CurrentUser() user: AuthUser) {
    return this.tracker.exportData(user.userId);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.tracker.deleteAccount(user.userId);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Get('courses')
  courses() {
    return this.tracker.courses();
  }

  @Put('days/:day')
  saveDay(@CurrentUser() user: AuthUser, @Param('day', ParseIntPipe) day: number, @Body() dto: SaveDayDto) {
    return this.tracker.saveDay(user.userId, day, dto);
  }

  @Put('progress/:courseId')
  saveProgress(@CurrentUser() user: AuthUser, @Param('courseId', ParseIntPipe) courseId: number, @Body() dto: SaveProgressDto) {
    return this.tracker.saveProgress(user.userId, courseId, dto.percent);
  }

  // Called by the Chrome extension only.
  @Post('sync')
  @HttpCode(200)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async sync(@CurrentUser() user: AuthUser, @Body() dto: SyncDto) {
    if (user.kind !== 'extension') throw new ForbiddenException('Only the extension can sync');
    await this.tokens.touch(user.sessionId);
    return this.tracker.sync(user.userId, dto.items);
  }

  // --- Connected devices (sessions) ------------------------------------------

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.tracker.sessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id) || !(await this.tokens.revoke(user.userId, id))) throw new NotFoundException();
  }

  @Post('sessions/revoke-others')
  async revokeOthers(@CurrentUser() user: AuthUser) {
    return { revoked: await this.tokens.revokeOthers(user.userId, user.sessionId) };
  }

  // --- Live updates (Server-Sent Events) -------------------------------------

  @Sse('events')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    const { events, close } = this.events.open(user.userId, user.sessionId);
    const heartbeat = interval(25_000).pipe(map(() => ({ type: 'ping', data: {} })));
    const ended = events.pipe(ignoreElements(), endWith(true)); // session revoked or account deleted
    return merge(events.pipe(map((e) => ({ type: 'change', data: e }))), heartbeat).pipe(takeUntil(ended), finalize(close));
  }
}
