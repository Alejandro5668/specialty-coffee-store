import { createHash } from 'node:crypto';
import { ChecksumEventVerifier } from './checksum-event.verifier';

const SECRET = 'test_events_secret';
const verifier = new ChecksumEventVerifier(SECRET);

const checksum = (values: string[], timestamp: number, secret = SECRET) =>
  createHash('sha256')
    .update(`${values.join('')}${timestamp}${secret}`)
    .digest('hex');

type Over = Record<string, unknown>;
const event = (over: Over = {}, tx: Over = {}, sig: Over = {}) => {
  const transaction = {
    id: '1234-1610641025-49201',
    status: 'APPROVED',
    amount_in_cents: 7_500_000,
    reference: 't1',
    ...tx,
  };
  const timestamp = 1_530_291_411;
  return {
    event: 'transaction.updated',
    data: { transaction },
    environment: 'test',
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: checksum(
        ['1234-1610641025-49201', String(transaction.status), '7500000'],
        timestamp,
      ),
      ...sig,
    },
    timestamp,
    sent_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
};

describe('ChecksumEventVerifier', () => {
  it('accepts a correctly signed event and maps it', () => {
    expect(verifier.verify(event())).toEqual({
      ok: true,
      value: {
        reference: 't1',
        providerRef: '1234-1610641025-49201',
        status: 'APPROVED',
        amountInCents: 7_500_000,
      },
    });
  });

  it('compares the checksum case-insensitively', () => {
    const e = event();
    e.signature.checksum = e.signature.checksum.toUpperCase();
    expect(verifier.verify(e).ok).toBe(true);
  });

  it.each([
    ['DECLINED', 'DECLINED'],
    ['ERROR', 'ERROR'],
    ['VOIDED', 'DECLINED'],
    ['PENDING', 'PENDING'],
    ['SOMETHING_NEW', 'PENDING'],
  ])('maps the provider status %s to %s', (provider, ours) => {
    // the default checksum covers APPROVED, so sign again for each status
    const e = event({}, { status: provider });
    e.signature.checksum = checksum(['1234-1610641025-49201', provider, '7500000'], e.timestamp);
    expect(verifier.verify(e)).toMatchObject({ ok: true, value: { status: ours } });
  });

  it('rejects a forged checksum', () => {
    expect(verifier.verify(event({}, {}, { checksum: 'f'.repeat(64) }))).toEqual({
      ok: false,
      error: 'INVALID_SIGNATURE',
    });
  });

  it('rejects an event signed with another secret', () => {
    const e = event();
    e.signature.checksum = checksum(
      ['1234-1610641025-49201', 'APPROVED', '7500000'],
      e.timestamp,
      'other',
    );
    expect(verifier.verify(e)).toEqual({ ok: false, error: 'INVALID_SIGNATURE' });
  });

  it.each([
    ['status', { status: 'DECLINED' }],
    ['amount', { amount_in_cents: 1 }],
    ['transaction id', { id: 'another-id' }],
  ])('rejects an event whose %s was changed after signing', (_label, change) => {
    const e = event();
    Object.assign(e.data.transaction, change);
    expect(verifier.verify(e)).toEqual({ ok: false, error: 'INVALID_SIGNATURE' });
  });

  it('rejects an event whose timestamp was changed after signing', () => {
    expect(verifier.verify(event({ timestamp: 1 }))).toEqual({
      ok: false,
      error: 'INVALID_SIGNATURE',
    });
  });

  it.each([
    ['too short', 'abc'],
    ['empty', ''],
    ['not hex', 'z'.repeat(64)],
  ])('rejects a checksum that is %s without throwing', (_label, value) => {
    expect(verifier.verify(event({}, {}, { checksum: value }))).toEqual({
      ok: false,
      error: 'INVALID_SIGNATURE',
    });
  });

  it('does not accept a signature that leaves out the fields we rely on', () => {
    const e = event();
    e.signature.properties = ['transaction.id'];
    e.signature.checksum = checksum(['1234-1610641025-49201'], e.timestamp);
    expect(verifier.verify(e)).toEqual({ ok: false, error: 'INVALID_SIGNATURE' });
  });

  it.each([
    ['null', null],
    ['text', 'text'],
    ['number', 42],
    ['array', []],
    ['empty object', {}],
    ['another event type', event({ event: 'nequi_token.updated' })],
    ['no transaction', event({ data: {} })],
    ['no signature', event({ signature: undefined })],
    ['no checksum', event({}, {}, { checksum: undefined })],
    ['properties not an array', event({}, {}, { properties: 'transaction.id' })],
    ['non-numeric timestamp', event({ timestamp: '1530291411' })],
    ['object-valued property', event({}, { id: { nested: true } })],
    ['non-integer amount', event({}, { amount_in_cents: 1.5 })],
    ['string reference missing', event({}, { reference: undefined })],
  ])('treats %s as malformed', (_label, payload) => {
    expect(verifier.verify(payload)).toEqual({ ok: false, error: 'MALFORMED_EVENT' });
  });

  it.each([
    '__proto__.polluted',
    'constructor.name',
    'transaction..id',
    'transaction.id; DROP',
    '',
  ])('refuses the unsafe property path %p', (path) => {
    const e = event({}, {}, { properties: [path] });
    expect(verifier.verify(e)).toEqual({ ok: false, error: 'MALFORMED_EVENT' });
  });
});
