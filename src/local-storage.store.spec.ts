/**
 * @jest-environment jsdom
 */

import { LocalStorageEngine } from './local-storage-engine';
import { StringValuedAsyncStore } from './string-valued.store';

describe('LocalStorageStore', () => {
  // Note: window.localStorage is mocked for the node environment via the jsdom jest environment
  const localStorageEngine = new LocalStorageEngine(window.localStorage, 'test');
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty object if entry is not present', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.entries()).toEqual({});
  });

  it('returns stored entries', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.entries()).toEqual({ key1: config1, key2: config2 });
  });

  it('is always expired without cooldown', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(true);
  });

  it('is not expired after entries are set until cooldown', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine, 10);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(false);

    // advance time by 5 seconds
    await jest.advanceTimersByTimeAsync(5 * 1000);
    expect(await store.isExpired()).toBe(false);

    // advance time by 6 more seconds (11 total)
    await jest.advanceTimersByTimeAsync(6 * 1000);
    expect(await store.isExpired()).toBe(true);
  });

  it('stores independently based on key suffix', async () => {
    const localStorageEngineEngineA = new LocalStorageEngine(window.localStorage, 'A');
    const storeA = new StringValuedAsyncStore(localStorageEngineEngineA, 1);
    const localStorageEngineEngineB = new LocalStorageEngine(window.localStorage, 'B');
    const storeB = new StringValuedAsyncStore(localStorageEngineEngineB, 1);

    await storeA.setEntries({ theKey: 'A' });
    expect(await storeA.entries()).toEqual({ theKey: 'A' });
    expect(await storeA.isExpired()).toBe(false);
    expect(await storeB.entries()).toEqual({});
    expect(await storeB.isExpired()).toBe(true);

    await jest.advanceTimersByTimeAsync(2000);

    await storeB.setEntries({ theKey: 'B' });
    expect(await storeA.entries()).toEqual({ theKey: 'A' });
    expect(await storeA.isExpired()).toBe(true);
    expect(await storeB.entries()).toEqual({ theKey: 'B' });
    expect(await storeB.isExpired()).toBe(false);
  });
});
