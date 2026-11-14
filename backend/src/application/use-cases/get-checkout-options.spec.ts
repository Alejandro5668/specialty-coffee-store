import { err } from '../../domain/shared/result';
import { BASE_FEE_CENTS, DELIVERY_FEE_CENTS, MAX_QUANTITY } from '../../domain/transaction/fees';
import { FakeGateway } from '../../../test/fakes/fake-gateway';
import { GetCheckoutOptions } from './get-checkout-options';

describe('GetCheckoutOptions', () => {
  it('returns the acceptance tokens and the fees the backend will charge', async () => {
    const result = await new GetCheckoutOptions(new FakeGateway()).execute();
    expect(result).toEqual({
      ok: true,
      value: {
        acceptance: { token: 'acc_123', permalink: 'https://example.test/terms.pdf' },
        personalData: { token: 'per_123', permalink: 'https://example.test/data.pdf' },
        fees: {
          currency: 'COP',
          baseFeeInCents: BASE_FEE_CENTS,
          deliveryFeeInCents: DELIVERY_FEE_CENTS,
        },
        maxQuantity: MAX_QUANTITY,
      },
    });
  });

  it('asks the provider every time, because the tokens are single use', async () => {
    const gateway = new FakeGateway();
    const options = new GetCheckoutOptions(gateway);
    await options.execute();
    await options.execute();
    expect(gateway.acceptanceCalls).toBe(2);
  });

  it('fails with GATEWAY_UNAVAILABLE when the provider cannot be reached, with no partial data', async () => {
    const gateway = new FakeGateway();
    gateway.acceptance = err('GATEWAY_UNAVAILABLE');
    expect(await new GetCheckoutOptions(gateway).execute()).toEqual({
      ok: false,
      error: 'GATEWAY_UNAVAILABLE',
    });
  });
});
