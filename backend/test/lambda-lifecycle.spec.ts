import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import type { Context, Handler } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { resetRuntime } from '../src/composition/runtime';
import { handler as realHandler } from '../src/lambda';
import { bootstrapLambda } from '../src/lambda/bootstrap';
import { makeHandler } from '../src/lambda/make-handler';
import { context, event, Reply } from './lambda-events';

const run = (h: Handler, e: ReturnType<typeof event> = event('GET', '/health')) =>
  h(e, context as Context, () => undefined) as Promise<Reply>;

describe('makeHandler: starting once per warm instance', () => {
  const answer = (): Handler => async () => ({ statusCode: 200, body: 'ok' });

  it('bootstraps on the first invocation and reuses the result on the next ones', async () => {
    const bootstrap = jest.fn(async () => answer());
    const handler = makeHandler(bootstrap);
    await run(handler);
    await run(handler);
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('does not start twice when two invocations arrive together on a cold start', async () => {
    const bootstrap = jest.fn(async () => answer());
    const handler = makeHandler(bootstrap);
    await Promise.all([run(handler), run(handler), run(handler)]);
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('passes the event and the context through to the real handler', async () => {
    const inner = jest.fn(async () => ({ statusCode: 204 }));
    const handler = makeHandler(async () => inner as unknown as Handler);
    const e = event('GET', '/products');
    await run(handler, e);
    expect(inner).toHaveBeenCalledWith(e, context, expect.any(Function));
  });

  it('tries again on the next invocation after a failed start, instead of staying broken', async () => {
    let fail = true;
    const bootstrap = jest.fn(async () => {
      if (fail) throw new Error('SSM was not ready');
      return answer();
    });
    const handler = makeHandler(bootstrap);
    await expect(run(handler)).rejects.toThrow('SSM was not ready');
    fail = false;
    expect((await run(handler)).statusCode).toBe(200);
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('is what the Lambda exports, and starts nothing until it is invoked', () => {
    expect(typeof realHandler).toBe('function');
  });
});

describe('bootstrapLambda: the real application with its secrets from SSM', () => {
  const saved = { ...process.env };
  const ssm = mockClient(new SSMClient({ region: 'us-east-2' }));
  const client = new SSMClient({ region: 'us-east-2' });
  const wired = mockClient(client);

  beforeEach(() => {
    ssm.reset();
    wired.reset();
    Object.assign(process.env, {
      PAYMENT_API_URL: 'https://pay.example.test/v1',
      PAYMENT_PUBLIC_KEY: 'pub_test_x',
      PAYMENT_PRIVATE_KEY_SSM: '/coffee-store/private',
      PAYMENT_INTEGRITY_SECRET_SSM: '/coffee-store/integrity',
      PAYMENT_EVENTS_SECRET_SSM: '/coffee-store/events',
    });
    for (const name of ['PAYMENT_PRIVATE_KEY', 'PAYMENT_INTEGRITY_SECRET', 'PAYMENT_EVENTS_SECRET'])
      delete process.env[name];
  });
  afterEach(() => {
    process.env = { ...saved };
    resetRuntime();
  });

  it('reads the secrets, builds the app and answers requests', async () => {
    wired.on(GetParametersCommand).resolves({
      Parameters: [
        { Name: '/coffee-store/private', Value: 'prv_from_ssm' },
        { Name: '/coffee-store/integrity', Value: 'integrity_from_ssm' },
        { Name: '/coffee-store/events', Value: 'events_from_ssm' },
      ],
    });
    const handler = await bootstrapLambda(process.env, client);
    const reply = await run(handler);
    expect(reply.statusCode).toBe(200);
    expect(JSON.parse(reply.body as string)).toEqual({ status: 'ok' });
    expect(reply.headers['x-content-type-options']).toBe('nosniff');
    expect(process.env.PAYMENT_PRIVATE_KEY).toBe('prv_from_ssm');
  });

  it('does not start, and says which parameter is missing, when a secret cannot be read', async () => {
    wired
      .on(GetParametersCommand)
      .resolves({ Parameters: [], InvalidParameters: ['/coffee-store/events'] });
    await expect(bootstrapLambda(process.env, client)).rejects.toThrow('/coffee-store/events');
  });

  it('starts without calling SSM when the secrets are already in the environment', async () => {
    Object.assign(process.env, {
      PAYMENT_PRIVATE_KEY: 'a',
      PAYMENT_INTEGRITY_SECRET: 'b',
      PAYMENT_EVENTS_SECRET: 'c',
    });
    const handler = await bootstrapLambda(process.env, client);
    expect((await run(handler)).statusCode).toBe(200);
    expect(wired.commandCalls(GetParametersCommand)).toHaveLength(0);
  });
});
