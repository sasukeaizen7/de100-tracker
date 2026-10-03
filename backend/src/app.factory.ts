import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config';

export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.with(config), {
    logger: process.env.NODE_ENV === 'test' ? false : undefined,
  });

  app.set('trust proxy', 1); // behind Vercel / a load balancer: real client IPs for rate limiting
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '2.5mb' }); // a large note with formulas is the biggest payload

  // The web app is served same-origin (proxied), so CORS only needs to admit the extension.
  const allowed = new Set([config.webOrigin, ...config.extensionIds.map((id) => `chrome-extension://${id}`)]);
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-DE92-Client'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  return app;
}
