import { browserStorage } from './browserStorage';

describe('browserStorage', () => {
  it('uses the storage of the tab, which is cleared when the tab closes', () => {
    const session = { getItem: jest.fn(), setItem: jest.fn() };
    expect(browserStorage({ sessionStorage: session })).toBe(session);
  });

  it('survives a browser that blocks storage, such as a sandboxed frame', () => {
    const blocked = {
      get sessionStorage(): Storage {
        throw new DOMException('Access denied', 'SecurityError');
      },
    };
    expect(browserStorage(blocked)).toBeNull();
  });
});
