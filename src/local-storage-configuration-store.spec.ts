/**
 * @jest-environment jsdom
 */

import { LocalStorageBackedAsyncStore } from './local-storage-configuration-store';

describe('LocalStorageBackedAsyncStore', () => {
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
    const store = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);
    expect(await store.getEntries()).toEqual({});
  });

  it('returns stored entries', async () => {
    const store = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.getEntries()).toEqual({ key1: config1, key2: config2 });
  });

  it('is always expired without cooldown', async () => {
    const store = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(true);
  });

  it('is not expired after entries are set until cooldown', async () => {
    jest.useFakeTimers();
    const store = new LocalStorageBackedAsyncStore<ITestEntry>(window.localStorage, 10);
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
