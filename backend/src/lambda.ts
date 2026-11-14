import { bootstrapLambda } from './lambda/bootstrap';
import { makeHandler } from './lambda/make-handler';

export const handler = makeHandler(() => bootstrapLambda());
