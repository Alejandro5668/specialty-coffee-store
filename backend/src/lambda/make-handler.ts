import type { Handler } from 'aws-lambda';

/**
 * Starts the application on the first invocation and keeps it for the life of the warm instance.
 * Invocations that arrive during the start wait for the same start; a failed start is not kept,
 * so the next invocation tries again.
 */
export const makeHandler = (bootstrap: () => Promise<Handler>): Handler => {
  let ready: Promise<Handler> | undefined;
  return async (event, context, callback) => {
    ready ??= bootstrap().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    return (await ready)(event, context, callback);
  };
};
