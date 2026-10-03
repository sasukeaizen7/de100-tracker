import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';
import { loadConfig } from './config';

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${config.port}/api`);
}

bootstrap();
