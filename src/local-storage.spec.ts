/**
 * @jest-environment jsdom
 */

import { EppoLocalStorage } from './local-storage';

describe('EppoLocalStorage', () => {
  interface ITestEntry {
    items: string[];
  }
  const config1 = {
    items: ['test', 'control', 'blue'],
  };
  const config2 = {
    items: ['red'],
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('no expiration configured', () => {
    const storage = new EppoLocalStorage();

    it('returns null if entry is not present', () => {
      expect(storage.get('does not exist')).toEqual(null);
    });

    it('is not expired', () => {
      expect(storage.isExpired()).toBe(false);
    });

    it('returns stored entries', () => {
      storage.setEntries({ key1: config1, key2: config2 });
      expect(storage.get<ITestEntry>('key1')).toEqual(config1);
      expect(storage.get<ITestEntry>('key2')).toEqual(config2);
    });

    it('clears existing entries', () => {
      window.localStorage.setItem('eppo-entry-stale-key1', JSON.stringify(config1));
      window.localStorage.setItem('unrelated-key', 'foo');
      storage.setEntries({ key1: config1, key2: config2 });

      expect(window.localStorage.getItem('eppo-entry-stale-key1')).toBe(null);
      expect(window.localStorage.getItem('unrelated-key')).toBe('foo');
    });
  });

  describe('expiration configured', () => {
    const expirationSeconds = 10;
    const storage = new EppoLocalStorage(expirationSeconds);

    beforeAll(() => {
      jest.useFakeTimers({
        advanceTimers: true,
      });
    });

    it('expires entries after the specified time', () => {
      storage.setEntries({ key1: config1 });

      expect(storage.isExpired()).toBe(false);
      jest.advanceTimersByTime((expirationSeconds + 1) * 1000);

      expect(storage.isExpired()).toBe(true);
    });
  });

  it('has local storage disabled', () => {
    const storage = new EppoLocalStorage();

    const {
      window: { localStorage },
    } = global;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.window.localStorage;
    storage.setEntries({ key1: config1 });
    expect(storage.get<ITestEntry>('key1')).toEqual(null);
    expect(storage.isExpired()).toBe(false);
    global.window.localStorage = localStorage;
  });
});
