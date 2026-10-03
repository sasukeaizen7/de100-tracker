import { Module } from '@nestjs/common';
import { ImagesController, NotesController } from './notes.controller';
import { ImagesService } from './images.service';
import { NotesService } from './notes.service';

@Module({
  controllers: [NotesController, ImagesController],
  providers: [NotesService, ImagesService],
})
export class NotesModule {}
