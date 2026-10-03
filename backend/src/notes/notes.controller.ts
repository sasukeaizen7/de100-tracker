import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/tokens.service';
import { ImagesService, MAX_IMAGE_BYTES } from './images.service';
import { CreateNoteDto, MoveNoteDto, UpdateNoteDto } from './notes.dto';
import { NotesService } from './notes.service';

@Controller('notes')
@UseGuards(AuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService, private readonly images: ImagesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notes.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.notes.create(user.userId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notes.get(user.userId, id);
  }

  // Autosave target: called every few seconds while typing.
  @Put(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(user.userId, id, dto);
  }

  @Patch(':id/move')
  move(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveNoteDto) {
    return this.notes.move(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notes.remove(user.userId, id);
  }

  @Post('images')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.images.upload(user.userId, file);
  }
}

// Served without an auth header (for <img> tags); the signed URL is the permission.
@Controller('images')
@SkipThrottle()
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get(':id')
  async image(@Param('id') id: string, @Query('sig') sig: string, @Res({ passthrough: true }) res: Response) {
    const img = await this.images.read(id, sig);
    res.set({
      'Content-Type': img.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    });
    return new StreamableFile(img.data);
  }
}
