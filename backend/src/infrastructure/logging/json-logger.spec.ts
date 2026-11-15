import { JsonLogger, requestContext } from './json-logger';

const make = () => {
  const lines: string[] = [];
  const logger = new JsonLogger(
    (line) => lines.push(line),
    () => new Date('2026-01-01T10:00:00.000Z'),
  );
  const last = () => JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
  return { logger, lines, last };
};

describe('JsonLogger', () => {
  it('writes one JSON line per event, with level, event and time', () => {
    const { logger, lines, last } = make();
    logger.info('order.settled', { orderId: 'o-1', status: 'APPROVED', totalCents: 4_300_000 });
    expect(lines).toHaveLength(1);
    expect(last()).toEqual({
      level: 'info',
      event: 'order.settled',
      time: '2026-01-01T10:00:00.000Z',
      orderId: 'o-1',
      status: 'APPROVED',
      totalCents: 4_300_000,
    });
  });

  it.each(['info', 'warn', 'error'] as const)('has the %s level', (level) => {
    const { logger, last } = make();
    logger[level]('x.y');
    expect(last().level).toBe(level);
  });

  it('adds the id of the request that is being served, so one purchase can be followed', () => {
    const { logger, last } = make();
    requestContext.run({ requestId: 'req-42' }, () => logger.info('a.b'));
    expect(last().requestId).toBe('req-42');
    logger.info('a.b');
    expect(last()).not.toHaveProperty('requestId');
  });

  it('keeps only plain values: an object, a function or an array never reaches the log', () => {
    const { logger, last } = make();
    logger.info('a.b', {
      ok: 'text',
      count: 3,
      flag: false,
      none: null,
      missing: undefined,
      customer: { name: 'Ana', email: 'ana@example.com' },
      list: ['a'],
      fn: () => 'x',
    } as never);
    expect(last()).toMatchObject({ ok: 'text', count: 3, flag: false, none: null });
    for (const dropped of ['missing', 'customer', 'list', 'fn'])
      expect(last()).not.toHaveProperty(dropped);
    expect(JSON.stringify(last())).not.toContain('ana@example.com');
  });

  it('cuts long text and replaces a number that is not finite', () => {
    const { logger, last } = make();
    logger.info('a.b', { long: 'x'.repeat(2_000), nan: NaN, inf: Infinity });
    expect((last().long as string).length).toBeLessThanOrEqual(501);
    expect(last().long).toMatch(/…$/);
    expect(last()).toMatchObject({ nan: null, inf: null });
  });

  it('never lets a field replace the level, the event, the time or the request id', () => {
    const { logger, last } = make();
    requestContext.run({ requestId: 'real' }, () =>
      logger.warn('real.event', { level: 'info', event: 'fake', time: 'now', requestId: 'fake' }),
    );
    expect(last()).toMatchObject({ level: 'warn', event: 'real.event', requestId: 'real' });
    expect(last().time).toBe('2026-01-01T10:00:00.000Z');
  });

  it('writes a hostile value as data on one line, never as a second log entry', () => {
    const { logger, lines, last } = make();
    logger.info('a.b', { note: 'ok\n{"level":"error","event":"forged"}\r\n' });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(last().event).toBe('a.b');
  });

  it('never throws, whatever the sink does: a log must not break a purchase', () => {
    const logger = new JsonLogger(() => {
      throw new Error('disk full');
    });
    expect(() => logger.error('a.b', { x: 1 })).not.toThrow();
  });

  it('writes to stdout by default, one line ending in a newline', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new JsonLogger().info('a.b');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/^\{.*\}\n$/);
    spy.mockRestore();
  });
});
