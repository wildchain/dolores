import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

export const CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
