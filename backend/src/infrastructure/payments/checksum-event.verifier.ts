import { createHash, timingSafeEqual } from 'node:crypto';
import { err, ok, Result } from '../../domain/shared/result';
import { EventError, EventVerifier, PaymentEvent } from '../../application/ports/event.verifier';

type Json = Record<string, unknown>;

const REQUIRED = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const MALFORMED = err('MALFORMED_EVENT' as const);
const INVALID = err('INVALID_SIGNATURE' as const);

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toStatus = (provider: string): PaymentEvent['status'] => {
  if (provider === 'APPROVED' || provider === 'DECLINED' || provider === 'ERROR') return provider;
  return provider === 'VOIDED' ? 'DECLINED' : 'PENDING';
};

/** Follows a dotted path through own properties only, so a path can never reach the prototype chain. */
const resolve = (root: Json, path: string): string | number | null => {
  if (!PATH.test(path)) return null;
  let current: unknown = root;
  for (const segment of path.split('.')) {
    if (FORBIDDEN.has(segment) || !isRecord(current) || !Object.hasOwn(current, segment))
      return null;
    current = current[segment];
  }
  return typeof current === 'string' || (typeof current === 'number' && Number.isFinite(current))
    ? current
    : null;
};

const sameChecksum = (expected: string, provided: string): boolean => {
  const given = provided.toLowerCase();
  if (given.length !== expected.length || !/^[0-9a-f]+$/.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'));
};

/**
 * Checksum = SHA256(values of signature.properties in order + timestamp + events secret).
 * The formula follows the provider docs; its worked example did not reproduce, so confirm it
 * with a real event once the API is public (see docs/PAYMENTS.md).
 */
export class ChecksumEventVerifier implements EventVerifier {
  constructor(private readonly eventsSecret: string) {}

  verify(payload: unknown): Result<PaymentEvent, EventError> {
    if (!isRecord(payload) || payload.event !== 'transaction.updated') return MALFORMED;
    const data = payload.data;
    const signature = payload.signature;
    if (!isRecord(data) || !isRecord(data.transaction) || !isRecord(signature)) return MALFORMED;
    const { properties, checksum } = signature;
    const timestamp = payload.timestamp;
    if (!Array.isArray(properties) || properties.length === 0 || properties.length > 10)
      return MALFORMED;
    if (typeof checksum !== 'string' || !Number.isSafeInteger(timestamp)) return MALFORMED;

    const tx = data.transaction;
    const { id, status, amount_in_cents: amount, reference } = tx;
    if (typeof id !== 'string' || id === '' || typeof status !== 'string') return MALFORMED;
    if (typeof reference !== 'string' || reference === '') return MALFORMED;
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) return MALFORMED;

    const values = properties.map((p) => (typeof p === 'string' ? resolve(data, p) : null));
    if (values.includes(null)) return MALFORMED;

    const signed = properties as string[];
    const expected = createHash('sha256')
      .update(`${values.join('')}${timestamp}${this.eventsSecret}`)
      .digest('hex');
    // Everything we act on (id, status, amount) must be covered by the signature.
    if (!REQUIRED.every((field) => signed.includes(field)) || !sameChecksum(expected, checksum)) {
      return INVALID;
    }
    return ok({
      reference,
      providerRef: id,
      status: toStatus(status),
      amountInCents: amount as number,
    });
  }
}
