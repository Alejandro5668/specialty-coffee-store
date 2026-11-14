import { configureStore } from '@reduxjs/toolkit';
import { CoffeeApi } from '../api/client';
import { catalogReducer, ThunkExtra } from '../store/catalogSlice';
import { checkoutReducer } from '../store/checkoutSlice';
import { loadPersisted, savePersisted } from '../store/persistence';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const createStore = ({ api, storage }: { api: CoffeeApi; storage: StorageLike | null }) => {
  const store = configureStore({
    reducer: { catalog: catalogReducer, checkout: checkoutReducer },
    preloadedState: loadPersisted(storage),
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: { api } satisfies ThunkExtra } }),
  });

  let saved = store.getState().checkout;
  store.subscribe(() => {
    const { checkout } = store.getState();
    if (checkout === saved) return;
    saved = checkout;
    savePersisted(storage, { checkout });
  });

  return store;
};

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
