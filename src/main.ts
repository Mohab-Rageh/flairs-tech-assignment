import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as express from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception-filter';
import { UnknownErrorFilter } from './filters/unknown-error-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  dotenv.config();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new UnknownErrorFilter(), new HttpExceptionFilter());

  app.use(express.json({ limit: '10mb' }));

  const configService = app.get(ConfigService);
  app.use(
    cors(
      configService.get<string>('NODE_ENV') === 'development'
        ? { origin: '*' }
        : {
            origin:
              configService.get<string>('ALLOWED_ORIGINS')?.split(',') || [],
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            credentials: true,
          },
    ),
  );

  // Start server
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, () => {
    console.log(`Server now listening on port ${port}`);
  });
}

bootstrap().then(
  () => ({}),
  () => ({}),
);
