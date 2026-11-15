import { err, ok } from '../../domain/shared/result';
import { VARIANT_ID } from '../../../test/fakes/fixtures';
import { RecordingLogger } from '../../../test/fakes/recording-logger';
import { input, setup } from '../../../test/checkout-fixtures';

const arrange = (stock = 5) => {
  const logger = new RecordingLogger();
  return { logger, ...setup(stock, logger) };
};

describe('what a purchase reports', () => {
  it('says a new order reserved its stock, with the amount and nothing about the customer', async () => {
    const { checkout, logger } = arrange();
    await checkout.execute(input());
    expect(logger.lines[0]).toEqual({
      level: 'info',
      event: 'checkout.reserved',
      orderId: 'id-2',
      variantId: VARIANT_ID,
      quantity: 2,
      totalCents: 7_500_000,
    });
  });

  it('says what the provider answered to the charge', async () => {
    const { checkout, gateway, logger } = arrange();
    gateway.next = ok({ providerRef: 'prov-1', status: 'APPROVED' });
    await checkout.execute(input());
    expect(logger.lines.map((l) => [l.level, l.event, l.outcome])).toEqual([
      ['info', 'checkout.reserved', undefined],
      ['info', 'payment.charged', 'APPROVED'],
      ['info', 'order.settled', undefined],
    ]);
  });

  it('warns when the provider refuses the charge, and when its answer is unknown', async () => {
    const refused = arrange();
    refused.gateway.next = err('GATEWAY_REJECTED');
    await refused.checkout.execute(input());
    expect(refused.logger.lines.find((l) => l.event === 'payment.charged')).toMatchObject({
      level: 'warn',
      outcome: 'REJECTED',
    });

    const unknown = arrange();
    unknown.gateway.next = err('GATEWAY_UNAVAILABLE');
    await unknown.checkout.execute(input());
    expect(unknown.logger.lines.find((l) => l.event === 'payment.charged')).toMatchObject({
      level: 'warn',
      outcome: 'UNAVAILABLE',
    });
    expect(unknown.logger.events()).not.toContain('order.settled');
  });

  it('records a settlement with where it came from and what happened to the stock', async () => {
    const { checkout, gateway, logger } = arrange();
    gateway.next = ok({ providerRef: 'prov-1', status: 'DECLINED' });
    await checkout.execute(input());
    expect(logger.lines.find((l) => l.event === 'order.settled')).toEqual({
      level: 'info',
      event: 'order.settled',
      orderId: 'id-2',
      status: 'DECLINED',
      source: 'charge',
      stockReleased: true,
      deliveryAssigned: false,
    });
  });

  it('says a repeated submit was answered with the first order, and charges nothing', async () => {
    const { checkout, gateway, logger } = arrange();
    await checkout.execute(input());
    logger.lines.length = 0;
    await checkout.execute(input());
    expect(logger.lines).toEqual([
      { level: 'info', event: 'checkout.replayed', orderId: 'id-2', status: 'PENDING' },
    ]);
    expect(gateway.charges).toHaveLength(1);
  });

  it.each([
    ['INVALID_INPUT', input({ quantity: -1 })],
    ['OUT_OF_STOCK', input({ quantity: 9 })],
  ] as const)('warns why an order was refused: %s', async (reason, body) => {
    const { checkout, logger } = arrange();
    await checkout.execute(body);
    expect(logger.lines).toEqual([
      expect.objectContaining({ level: 'warn', event: 'checkout.rejected', reason }),
    ]);
  });

  it('does not write what the shopper sent when the variant does not exist', async () => {
    const { checkout, logger } = arrange();
    await checkout.execute(input({ variantId: '<script>alert(1)</script>' }));
    expect(logger.lines[0]).toMatchObject({
      event: 'checkout.rejected',
      reason: 'VARIANT_NOT_FOUND',
    });
    expect(logger.text()).not.toContain('script');
  });

  it('never writes the customer, the delivery, the email, the card token or the terms tokens', async () => {
    const { checkout, gateway, logger } = arrange();
    gateway.next = ok({ providerRef: 'prov-9', status: 'APPROVED' });
    await checkout.execute(input());
    for (const secret of [
      'Ana',
      'ana@example.com',
      'Calle 10',
      'Medellín',
      '3001234567',
      'tok_test_123',
      'acc_123',
      'per_123',
    ]) {
      expect(logger.text()).not.toContain(secret);
    }
  });
});
