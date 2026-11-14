import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';
import { DataStack } from '../lib/data-stack';
import { loadDeployConfig } from '../lib/deploy-config';

const root = join(__dirname, '..', '..');
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };
const app = new App();
const data = new DataStack(app, 'CoffeeStoreData', { env });
new AppStack(app, 'CoffeeStoreApp', {
  env,
  tables: data.tables,
  lambdaCodePath: join(root, 'backend', 'build', 'lambda'),
  frontendPath: join(root, 'frontend', 'dist'),
  ...loadDeployConfig(process.env),
});
