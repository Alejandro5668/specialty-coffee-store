import { FakeVerifier } from '../../../test/fakes/fake-verifier';
import { RecordingLogger } from '../../../test/fakes/recording-logger';
import { input, setup } from '../../../test/checkout-fixtures';
import { GetTransaction } from './get-transaction';
import { ProcessPaymentEvent } from './process-payment-event';

const arrange = (stock = 5) => {
  const logger = new RecordingLogger();
  return { logger, ...setup(stock, logger) };
};

describe('what the status check and the webhook report', () => {
  const later = (ctx: ReturnType<typeof arrange>, id: string, now = '2026-01-01T00:01:00.000Z') => {
    const logger = new RecordingLogger();
    const clock = { now: () => now };
    return {
      logger,
      getTransaction: new GetTransaction(ctx.transactions, ctx.gateway, ctx.orders, clock, logger),
      id,
    };
  };

  it('records that the provider settled an order the shopper was waiting for', async () => {
    const ctx = arrange();
    const placed = await ctx.checkout.execute(input());
    if (!placed.ok) throw new Error('setup');
    ctx.gateway.known.set(placed.value.id, { providerRef: 'prov-1', status: 'APPROVED' });
    const { getTransaction, logger } = later(ctx, placed.value.id);
    await getTransaction.execute(placed.value.id);
    expect(logger.lines).toEqual([
      expect.objectContaining({
        event: 'order.settled',
        status: 'APPROVED',
        source: 'polling',
        deliveryAssigned: true,
      }),
    ]);
  });

  it('warns when the provider cannot be asked, which is what explains a slow confirmation', async () => {
    const ctx = arrange();
    const placed = await ctx.checkout.execute(input());
    if (!placed.ok) throw new Error('setup');
    ctx.gateway.lookupFails = true;
    const { getTransaction, logger } = later(ctx, placed.value.id);
    await getTransaction.execute(placed.value.id);
    expect(logger.lines).toEqual([
      { level: 'warn', event: 'order.provider_unreachable', orderId: placed.value.id },
    ]);
  });

  it('records an order the provider never knew as expired', async () => {
    const ctx = arrange();
    const placed = await ctx.checkout.execute(input());
    if (!placed.ok) throw new Error('setup');
    // Ten minutes later: past the five the provider is given to learn about an order.
    const { getTransaction, logger } = later(ctx, placed.value.id, '2026-01-01T00:10:00.000Z');
    await getTransaction.execute(placed.value.id);
    expect(logger.lines).toEqual([
      expect.objectContaining({
        event: 'order.settled',
        status: 'ERROR',
        source: 'expired',
        stockReleased: true,
      }),
    ]);
  });

  const webhook = async () => {
    const ctx = arrange();
    const placed = await ctx.checkout.execute(input());
    if (!placed.ok) throw new Error('setup');
    const logger = new RecordingLogger();
    const processor = new ProcessPaymentEvent(
      new FakeVerifier(),
      ctx.transactions,
      ctx.orders,
      logger,
    );
    const event = (over: Record<string, unknown> = {}) => ({
      signature: 'valid',
      reference: placed.value.id,
      providerRef: 'prov-1',
      status: 'APPROVED',
      amountInCents: 7_500_000,
      ...over,
    });
    return { processor, logger, event, id: placed.value.id };
  };

  it('records an accepted event with the order and its final status', async () => {
    const { processor, logger, event, id } = await webhook();
    await processor.execute(event());
    expect(logger.lines.map((l) => [l.level, l.event, l.orderId, l.status, l.source])).toEqual([
      ['info', 'order.settled', id, 'APPROVED', 'webhook'],
      ['info', 'webhook.accepted', id, 'APPROVED', undefined],
    ]);
  });

  it.each([
    ['a forged signature', { signature: 'forged' }, 'INVALID_SIGNATURE'],
    ['an unknown order', { reference: 'nope' }, 'UNKNOWN_TRANSACTION'],
    ['another amount', { amountInCents: 1 }, 'AMOUNT_MISMATCH'],
  ])(
    'warns with the reason for %s, and writes nothing of the event',
    async (_label, over, reason) => {
      const { processor, logger, event } = await webhook();
      await processor.execute(event(over));
      expect(logger.lines).toEqual([{ level: 'warn', event: 'webhook.rejected', reason }]);
      expect(logger.text()).not.toMatch(/forged|nope|prov-1/);
    },
  );

  it('says an event that arrives again for a settled order was a replay', async () => {
    const { processor, logger, event } = await webhook();
    await processor.execute(event());
    logger.lines.length = 0;
    await processor.execute(event());
    expect(logger.lines.map((l) => l.event)).toEqual(['order.settle_skipped', 'webhook.accepted']);
  });
});
