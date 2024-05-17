/**
 * @jest-environment jsdom
 */

import { LocalStorageBackedAsyncStore } from './local-storage';

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

  const storage = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);

  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('get and set', () => {
    it('returns empty object if entry is not present', async () => {
      expect(await storage.getEntries()).toEqual({});
    });

    it('returns stored entries', async () => {
      await storage.setEntries({ key1: config1, key2: config2 });
      expect(await storage.getEntries()).toEqual({ key1: config1, key2: config2 });
    });
  });
});
