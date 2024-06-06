/**
 * @jest-environment jsdom
 */

import { LocalStorageEngine } from './local-storage-engine';
import { StringValuedAsyncStore } from './string-valued.store';

describe('LocalStorageStore', () => {
  // Note: window.localStorage is mocked for the node environment via the jsdom jest environment
  const localStorageEngine = new LocalStorageEngine(window.localStorage);
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty object if entry is not present', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.getEntries()).toEqual({});
  });

  it('returns stored entries', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.getEntries()).toEqual({ key1: config1, key2: config2 });
  });

  it('is always expired without cooldown', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(true);
  });

  it('is not expired after entries are set until cooldown', async () => {
    jest.useFakeTimers();
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
});
