// Vercel serverless entry — NestJS served from compiled dist/
// Build command (set in Vercel project settings):
//   npm ci && npx prisma generate && npx prisma db push && npm run build

const express = require('express');
const server = express();
let nestApp;

async function bootstrap() {
  if (nestApp) return;

  const { NestFactory } = require('@nestjs/core');
  const { ExpressAdapter } = require('@nestjs/platform-express');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../dist/app.module');
  const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
  const { LoggingInterceptor } = require('../dist/common/interceptors/logging.interceptor');
  const { TransformInterceptor } = require('../dist/common/interceptors/transform.interceptor');

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  await app.init();
  nestApp = app;
}

module.exports = async (req, res) => {
  await bootstrap();
  server(req, res);
};
