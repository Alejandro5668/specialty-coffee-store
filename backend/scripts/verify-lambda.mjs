// Starts the packaged handler away from the repository, so a missing dependency cannot be found
// in the root node_modules, and sends it API Gateway events. Uses placeholder settings only.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'lambda');
const copy = mkdtempSync(join(tmpdir(), 'lambda-verify-'));
cpSync(source, copy, { recursive: true, verbatimSymlinks: true });

Object.assign(process.env, {
  PAYMENT_API_URL: 'https://placeholder.invalid/v1',
  PAYMENT_PUBLIC_KEY: 'placeholder',
  PAYMENT_PRIVATE_KEY: 'placeholder',
  PAYMENT_INTEGRITY_SECRET: 'placeholder',
  PAYMENT_EVENTS_SECRET: 'placeholder',
  AWS_REGION: 'us-east-2',
  AWS_ACCESS_KEY_ID: 'placeholder',
  AWS_SECRET_ACCESS_KEY: 'placeholder',
});

const event = (method, path, body) => ({
  version: '2.0',
  routeKey: '$default',
  rawPath: path,
  rawQueryString: '',
  headers: { 'content-type': 'application/json' },
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    domainName: 'api.example.test',
    domainPrefix: 'api',
    http: { method, path, protocol: 'HTTP/1.1', sourceIp: '203.0.113.7', userAgent: 'verify' },
    requestId: 'request-id',
    routeKey: '$default',
    stage: '$default',
    time: '01/Jan/2026:00:00:00 +0000',
    timeEpoch: 1_767_225_600_000,
  },
  body: body === undefined ? undefined : JSON.stringify(body),
  isBase64Encoded: false,
});
const context = {
  functionName: 'verify',
  awsRequestId: 'request-id',
  getRemainingTimeInMillis: () => 30_000,
};

const checks = [
  ['GET', '/health', undefined, 200],
  ['GET', '/docs/openapi.json', undefined, 200],
  ['POST', '/checkout', {}, 400],
  ['GET', '/nope', undefined, 404],
];

let failed = false;
try {
  const { handler } = createRequire(join(copy, 'noop.js'))('./lambda.js');
  for (const [method, path, body, expected] of checks) {
    const reply = await handler(event(method, path, body), context, () => undefined);
    console.log(`${method} ${path} ${reply.statusCode}`);
    if (reply.statusCode !== expected) failed = true;
  }
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  rmSync(copy, { recursive: true, force: true });
}
if (failed) {
  console.error('Lambda package FAILED');
  process.exit(1);
}
console.log('Lambda package OK');
process.exit(0);
