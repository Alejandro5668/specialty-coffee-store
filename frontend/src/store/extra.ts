import { CoffeeApi } from '../api/client';

/** What every thunk may use. Tests replace all of it, so nothing here touches the network or the clock. */
export type ThunkExtra = { api: CoffeeApi; newId: () => string; now: () => number };
