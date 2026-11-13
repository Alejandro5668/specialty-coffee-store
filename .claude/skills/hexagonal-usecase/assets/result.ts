export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const andThen = async <T, U, E, F>(
  result: Result<T, E> | Promise<Result<T, E>>,
  next: (value: T) => Promise<Result<U, F>> | Result<U, F>,
): Promise<Result<U, E | F>> => {
  const current = await result;
  return current.ok ? next(current.value) : current;
};
