import { PERSIST_KEY } from '../store/persistence';

/** A storage in memory, with the setItem calls counted. */
export const memoryStorage = (saved?: string) => {
  const data = new Map<string, string>();
  if (saved !== undefined) data.set(PERSIST_KEY, saved);
  const setItem = jest.fn((k: string, v: string) => void data.set(k, v));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem };
};
