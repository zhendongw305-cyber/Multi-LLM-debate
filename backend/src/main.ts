import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const server = await app.listen(process.env.PORT ?? 3001);
  // Increase timeout to 10 minutes for long-running debates
  server.setTimeout(600000);
}
bootstrap();
