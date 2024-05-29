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

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns empty object if entry is not present', async () => {
    const storage = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);
    expect(await storage.getEntries()).toEqual({});
  });

  it('returns stored entries', async () => {
    const storage = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);
    await storage.setEntries({ key1: config1, key2: config2 });
    expect(await storage.getEntries()).toEqual({ key1: config1, key2: config2 });
  });

  it('stores independently based on key suffix', async () => {
    const storageA = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage, 'A');
    const storageB = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage, 'B');

    await storageA.setEntries({ flagA: config1 });

    expect(await storageA.getEntries()).toEqual({ flagA: config1 });
    expect(await storageB.getEntries()).toEqual({});

    await storageB.setEntries({ flagB: config2 });

    expect(await storageA.getEntries()).toEqual({ flagA: config1 });
    expect(await storageB.getEntries()).toEqual({ flagB: config2 });
  });
});
