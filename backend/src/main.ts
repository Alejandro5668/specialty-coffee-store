import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './interface/http/configure-app';
import { loadHttpConfig } from './interface/http/http-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app, loadHttpConfig(process.env));
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
