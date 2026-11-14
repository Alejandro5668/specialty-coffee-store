// One command: package the backend, build the frontend, deploy both stacks, load the seed.
// Needs PAYMENT_API_URL, PAYMENT_PUBLIC_KEY and AWS credentials in the environment.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = {
  ...process.env,
  AWS_REGION: 'us-east-2',
  VITE_PAYMENT_API_URL: process.env.PAYMENT_API_URL,
  VITE_PAYMENT_PUBLIC_KEY: process.env.PAYMENT_PUBLIC_KEY,
};
for (const name of ['PAYMENT_API_URL', 'PAYMENT_PUBLIC_KEY']) {
  if (!process.env[name]) {
    console.error(`${name} is required`);
    process.exit(1);
  }
}
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });

run('npm', ['run', 'package:lambda', '-w', 'backend']);
run('npm', ['run', 'build', '-w', 'frontend']);
run(
  'npx',
  ['cdk', 'deploy', 'CoffeeStoreData', '--require-approval', 'never'],
  join(root, 'infra'),
);
run('npm', ['run', 'seed', '-w', 'backend']);
run(
  'npx',
  [
    'cdk',
    'deploy',
    'CoffeeStoreApp',
    '--require-approval',
    'never',
    '--outputs-file',
    'cdk.out/outputs.json',
  ],
  join(root, 'infra'),
);
console.log('Deployed. Next: npm run smoke -w infra -- <SiteUrl from cdk.out/outputs.json>');
