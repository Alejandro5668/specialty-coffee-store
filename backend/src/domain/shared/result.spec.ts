import { andThen, err, map, ok, Result } from './result';

describe('Result', () => {
  it('ok wraps a value', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('err wraps an error', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('map transforms an ok value', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('map keeps the error untouched', () => {
    const failed: Result<number, string> = err('boom');
    expect(map(failed, (n) => n * 3)).toEqual(err('boom'));
  });

  it('andThen chains the next step on ok', async () => {
    const result = await andThen(ok(2), (n) => ok(n + 1));
    expect(result).toEqual(ok(3));
  });

  it('andThen short-circuits on error and skips the next step', async () => {
    const next = jest.fn();
    const result = await andThen(err('boom'), next);
    expect(result).toEqual(err('boom'));
    expect(next).not.toHaveBeenCalled();
  });

  it('andThen accepts a promised result', async () => {
    const result = await andThen(Promise.resolve(ok(1)), async (n) => ok(n + 1));
    expect(result).toEqual(ok(2));
  });
});
