import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { buildOpenApi } from './swagger';

/**
 * Writes docs/openapi.json. Nothing is called: the adapters only need to be built, so
 * placeholder payment settings are enough and no AWS credentials are used.
 */
const PLACEHOLDERS = {
  PAYMENT_API_URL: 'https://placeholder.invalid/v1',
  PAYMENT_PRIVATE_KEY: 'placeholder',
  PAYMENT_INTEGRITY_SECRET: 'placeholder',
  PAYMENT_EVENTS_SECRET: 'placeholder',
};

async function generate(): Promise<void> {
  for (const [name, value] of Object.entries(PLACEHOLDERS)) process.env[name] ??= value;
  const app = await NestFactory.create(AppModule, { logger: false });
  const file = join(__dirname, '../../../../docs/openapi.json');
  writeFileSync(file, `${JSON.stringify(buildOpenApi(app), null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${file}`);
}

void generate();
