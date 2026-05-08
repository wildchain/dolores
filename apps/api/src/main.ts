import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for UI
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://dolores.wildchain.io',
      'https://dolores.id',
    ],
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 8545;
  await app.listen(port);

  console.log(`🚀 Dolores API running on http://localhost:${port}`);
}
bootstrap();
