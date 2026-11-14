type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/**
 * The draft holds a name, an address and a phone number, so it lives in the tab's own storage:
 * it survives a refresh, and it is gone when the tab closes. Some browsers refuse access to
 * storage; the shop still works, it just cannot recover after a refresh.
 */
export const browserStorage = (win: { readonly sessionStorage: Storage }): Storage | null => {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
};
