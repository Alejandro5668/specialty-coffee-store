import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/app-stack';
import { DataStack } from '../lib/data-stack';

/** Both stacks, built with throwaway asset folders so no real build is needed. */
export const build = () => {
  const dir = mkdtempSync(join(tmpdir(), 'infra-test-'));
  writeFileSync(join(dir, 'lambda.js'), 'exports.handler = async () => ({});');
  writeFileSync(join(dir, 'index.html'), '<!doctype html>');
  const app = new App();
  const env = { account: '123456789012', region: 'us-east-2' };
  const data = new DataStack(app, 'Data', { env });
  const api = new AppStack(app, 'App', {
    env,
    tables: data.tables,
    lambdaCodePath: dir,
    frontendPath: dir,
    paymentApiUrl: 'https://payments.example.test/v1',
    paymentPublicKey: 'pub_test_123',
  });
  return { data: Template.fromStack(data), api: Template.fromStack(api) };
};
