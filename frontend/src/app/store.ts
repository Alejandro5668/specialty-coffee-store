import { configureStore } from '@reduxjs/toolkit';
import { CoffeeApi } from '../api/client';
import { catalogReducer } from '../store/catalogSlice';
import { checkoutReducer } from '../store/checkoutSlice';
import { ThunkExtra } from '../store/extra';
import { optionsReducer } from '../store/optionsSlice';
import { orderReducer } from '../store/orderSlice';
import { loadPersisted, savePersisted, toPersistable } from '../store/persistence';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Options = {
  api: CoffeeApi;
  storage: StorageLike | null;
  newId?: () => string;
  now?: () => number;
};

export const createStore = ({
  api,
  storage,
  newId = () => crypto.randomUUID(),
  now = Date.now,
}: Options) => {
  const extra: ThunkExtra = { api, newId, now };
  const store = configureStore({
    reducer: {
      catalog: catalogReducer,
      options: optionsReducer,
      order: orderReducer,
      checkout: checkoutReducer,
    },
    preloadedState: loadPersisted(storage, now()),
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: extra } }),
  });

  // Saves the draft only when something worth keeping changed, not on every screen-only update.
  let saved = JSON.stringify(toPersistable(store.getState().checkout));
  store.subscribe(() => {
    const { checkout } = store.getState();
    const next = JSON.stringify(toPersistable(checkout));
    if (next === saved) return;
    saved = next;
    savePersisted(storage, checkout);
  });

  return store;
};

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
