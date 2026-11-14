import serverlessExpress from '@codegenie/serverless-express';
import { INestApplication } from '@nestjs/common';
import type { Handler } from 'aws-lambda';

/** Turns the Nest app (Express underneath) into a Lambda handler for API Gateway events. */
export const toHandler = (app: INestApplication): Handler =>
  serverlessExpress({ app: app.getHttpAdapter().getInstance() });
