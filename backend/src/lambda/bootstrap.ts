import { SSMClient } from '@aws-sdk/client-ssm';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Handler } from 'aws-lambda';
import { AppModule } from '../app.module';
import { loadSecrets, secretParameters } from '../infrastructure/aws/secrets';
import { configureApp } from '../interface/http/configure-app';
import { loadHttpConfig } from '../interface/http/http-config';
import { setupSwagger } from '../interface/http/swagger';
import { toHandler } from './to-handler';

/** Same setup as the server, but the secrets come from SSM and the result is a Lambda handler. */
export const bootstrapLambda = async (
  env: NodeJS.ProcessEnv = process.env,
  ssm: Pick<SSMClient, 'send'> = new SSMClient({}),
): Promise<Handler> => {
  Object.assign(env, await loadSecrets(ssm, secretParameters(env)));

  // Only errors and warnings: the start-up lines of every module only add to the cold start.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  configureApp(app, loadHttpConfig(env));
  setupSwagger(app);
  await app.init();
  return toHandler(app);
};
