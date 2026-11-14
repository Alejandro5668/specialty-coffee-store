import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { loadSecrets, secretParameters } from './secrets';

const client = new SSMClient({ region: 'us-east-2' });
const ssm = mockClient(client);
beforeEach(() => ssm.reset());

const PARAMS = {
  PAYMENT_PRIVATE_KEY: '/coffee-store/private',
  PAYMENT_INTEGRITY_SECRET: '/coffee-store/integrity',
  PAYMENT_EVENTS_SECRET: '/coffee-store/events',
};

describe('secretParameters', () => {
  it('maps each secret to the SSM parameter named in <NAME>_SSM', () => {
    expect(
      secretParameters({
        PAYMENT_PRIVATE_KEY_SSM: '/coffee-store/private',
        PAYMENT_INTEGRITY_SECRET_SSM: '/coffee-store/integrity',
        PAYMENT_EVENTS_SECRET_SSM: '/coffee-store/events',
      }),
    ).toEqual(PARAMS);
  });

  it('leaves out a secret that is already set, so a local .env always wins', () => {
    const found = secretParameters({
      PAYMENT_PRIVATE_KEY: 'prv_local',
      PAYMENT_PRIVATE_KEY_SSM: '/coffee-store/private',
      PAYMENT_EVENTS_SECRET_SSM: '/coffee-store/events',
    });
    expect(found).toEqual({ PAYMENT_EVENTS_SECRET: '/coffee-store/events' });
  });

  it('ignores blank names and unrelated variables', () => {
    expect(
      secretParameters({ PAYMENT_PRIVATE_KEY_SSM: '  ', PATH: '/usr/bin', OTHER_SSM: '/x' }),
    ).toEqual({});
  });
});

describe('loadSecrets', () => {
  it('reads every parameter in one decrypted request and returns the values by variable name', async () => {
    ssm.on(GetParametersCommand).resolves({
      Parameters: [
        { Name: '/coffee-store/events', Value: 'events-value' },
        { Name: '/coffee-store/private', Value: 'private-value' },
        { Name: '/coffee-store/integrity', Value: 'integrity-value' },
      ],
    });
    expect(await loadSecrets(client, PARAMS)).toEqual({
      PAYMENT_PRIVATE_KEY: 'private-value',
      PAYMENT_INTEGRITY_SECRET: 'integrity-value',
      PAYMENT_EVENTS_SECRET: 'events-value',
    });
    const calls = ssm.commandCalls(GetParametersCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      Names: ['/coffee-store/private', '/coffee-store/integrity', '/coffee-store/events'],
      WithDecryption: true,
    });
  });

  it('does not call SSM when there is nothing to read', async () => {
    expect(await loadSecrets(client, {})).toEqual({});
    expect(ssm.commandCalls(GetParametersCommand)).toHaveLength(0);
  });

  it('names the parameters that do not exist, and only their names', async () => {
    ssm.on(GetParametersCommand).resolves({
      Parameters: [{ Name: '/coffee-store/private', Value: 'private-value' }],
      InvalidParameters: ['/coffee-store/integrity', '/coffee-store/events'],
    });
    const error = await loadSecrets(client, PARAMS).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('/coffee-store/integrity');
    expect((error as Error).message).toContain('/coffee-store/events');
    expect((error as Error).message).not.toContain('private-value');
  });

  it('refuses a parameter whose value is empty', async () => {
    ssm.on(GetParametersCommand).resolves({
      Parameters: [
        { Name: '/coffee-store/private', Value: '' },
        { Name: '/coffee-store/integrity', Value: 'integrity-value' },
        { Name: '/coffee-store/events', Value: 'events-value' },
      ],
    });
    await expect(loadSecrets(client, PARAMS)).rejects.toThrow('/coffee-store/private');
  });

  it('fails with a message that carries no secret when SSM itself fails', async () => {
    ssm.on(GetParametersCommand).rejects(new Error('AccessDeniedException: not allowed'));
    const error = await loadSecrets(client, PARAMS).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      'Could not read the payment secrets from SSM Parameter Store.',
    );
  });

  it('never prints a value', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    ssm.on(GetParametersCommand).resolves({
      Parameters: Object.values(PARAMS).map((Name) => ({ Name, Value: 'super-secret-value' })),
    });
    await loadSecrets(client, PARAMS);
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    log.mockRestore();
    info.mockRestore();
  });
});
