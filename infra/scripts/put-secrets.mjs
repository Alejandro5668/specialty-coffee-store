// Stores the three payment secrets in SSM Parameter Store as SecureString.
// Values come from the environment, never from arguments (those show up in `ps`) and are never printed.
import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const PARAMETERS = {
  PAYMENT_PRIVATE_KEY: '/coffee-store/payment-private-key',
  PAYMENT_INTEGRITY_SECRET: '/coffee-store/payment-integrity-secret',
  PAYMENT_EVENTS_SECRET: '/coffee-store/payment-events-secret',
};

const missing = Object.keys(PARAMETERS).filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing in the environment: ${missing.join(', ')}`);
  process.exit(1);
}
const ssm = new SSMClient({ region: 'us-east-2' });
for (const [name, parameter] of Object.entries(PARAMETERS)) {
  await ssm.send(
    new PutParameterCommand({
      Name: parameter,
      Value: process.env[name].trim(),
      Type: 'SecureString',
      Overwrite: true,
    }),
  );
  console.log(`Stored ${parameter}`);
}
