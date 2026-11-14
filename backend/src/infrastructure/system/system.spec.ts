import { SystemClock, UuidIdGenerator } from './system';

describe('UuidIdGenerator', () => {
  it('returns v4 UUIDs, so ids cannot be guessed or enumerated', () => {
    expect(new UuidIdGenerator().next()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('never repeats', () => {
    const ids = new UuidIdGenerator();
    expect(new Set(Array.from({ length: 1000 }, () => ids.next())).size).toBe(1000);
  });
});

describe('SystemClock', () => {
  it('returns the current time as an ISO string', () => {
    const before = Date.now();
    const now = new SystemClock().now();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(now)).toBeGreaterThanOrEqual(before);
  });
});
