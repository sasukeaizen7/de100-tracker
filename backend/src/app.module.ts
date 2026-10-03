import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfig, CONFIG } from './config';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';
import { NotesModule } from './notes/notes.module';
import { TrackerModule } from './tracker/tracker.module';

@Global()
@Module({})
class ConfigModule {
  static with(config: AppConfig): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] };
  }
}

@Module({})
export class AppModule {
  static with(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.with(config),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => !config.rateLimit }),
        DbModule,
        EventsModule,
        AuthModule,
        TrackerModule,
        NotesModule,
      ],
      controllers: [HealthController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
