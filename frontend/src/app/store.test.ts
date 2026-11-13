import { store } from './store';

describe('store', () => {
  it('starts with an empty state', () => {
    expect(store.getState()).toEqual({});
  });
});
