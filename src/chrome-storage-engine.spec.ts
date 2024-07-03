import { IAsyncStore } from '@eppo/js-client-sdk-common';

import ChromeStorageAsyncMap from './cache/chrome-storage-async-map';
import { ChromeStorageEngine } from './chrome-storage-engine';
import { StringValuedAsyncStore } from './string-valued.store';

import StorageArea = chrome.storage.StorageArea;

describe('ChromeStorageStore', () => {
  const mockEntries: Record<string, string> = { key1: 'value1', key2: 'value2' };

  // Have getters and setters manipulate an in-memory store, so we can test things regarding keys
  const fakeStore: Record<string, string> = {};

  const get = jest.fn((key: string) => {
    return new Promise((resolve) => {
      resolve({ [key]: fakeStore[key] });
    });
  }) as jest.Mock;

  const set = jest.fn((items: { [key: string]: string }) => {
    return new Promise((resolve) => {
      Object.assign(fakeStore, items);
      resolve(undefined);
    });
  }) as jest.Mock;

  const mockChromeStorage = { get, set } as unknown as StorageArea;
  const dummyKeySuffix = 'test';
  const fakeStoreContentsKey = `eppo-configuration-${dummyKeySuffix}`;
  const fakeStoreMetaKey = `eppo-configuration-meta-${dummyKeySuffix}`;
  const chromeStorageEngine = new ChromeStorageEngine(
    new ChromeStorageAsyncMap(mockChromeStorage),
    dummyKeySuffix,
  );
  let chromeStore: IAsyncStore<unknown>;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    jest.useFakeTimers();
    delete fakeStore[fakeStoreContentsKey];
    delete fakeStore[fakeStoreMetaKey];
    chromeStore = new StringValuedAsyncStore(chromeStorageEngine);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('is always expired without cooldown', async () => {
    chromeStore = new StringValuedAsyncStore(chromeStorageEngine, undefined);
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('is not expired with cooldown', async () => {
    chromeStore = new StringValuedAsyncStore(chromeStorageEngine, 10);

    fakeStore[fakeStoreContentsKey] = JSON.stringify(mockEntries);
    fakeStore[fakeStoreMetaKey] = JSON.stringify({
      lastUpdatedAtMs: new Date().getTime(),
    });

    expect(await chromeStore.isExpired()).toBe(false);
  });

  it('is expired after cooldown', async () => {
    chromeStore = new StringValuedAsyncStore(chromeStorageEngine, 10);

    fakeStore[fakeStoreContentsKey] = JSON.stringify(mockEntries);
    fakeStore[fakeStoreMetaKey] = JSON.stringify({
      lastUpdatedAtMs: now,
    });

    // advance time by 5 seconds
    await jest.advanceTimersByTimeAsync(5 * 1000);
    expect(await chromeStore.isExpired()).toBe(false);

    // advance time by 6 seconds
    await jest.advanceTimersByTimeAsync(6 * 1000);
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('should be initialized after setting entries', async () => {
    await chromeStore.setEntries(mockEntries);
    expect(chromeStore.isInitialized()).toBe(true);
  });

  it('should get entries', async () => {
    fakeStore[fakeStoreContentsKey] = JSON.stringify(mockEntries);

    const entries = await chromeStore.entries();
    expect(entries).toEqual(mockEntries);
  });

  it('stores independently based on key suffix', async () => {
    const chromeStorageEngineA = new ChromeStorageEngine(
      new ChromeStorageAsyncMap(mockChromeStorage),
      'A',
    );
    const chromeStoreA = new StringValuedAsyncStore(chromeStorageEngineA, 1);
    const chromeStorageEngineB = new ChromeStorageEngine(
      new ChromeStorageAsyncMap(mockChromeStorage),
      'B',
    );
    const chromeStoreB = new StringValuedAsyncStore(chromeStorageEngineB, 1);

    await chromeStoreA.setEntries({ theKey: 'A' });
    expect(await chromeStoreA.entries()).toEqual({ theKey: 'A' });
    expect(await chromeStoreA.isExpired()).toBe(false);
    expect(await chromeStoreB.entries()).toEqual({});
    expect(await chromeStoreB.isExpired()).toBe(true);

    await jest.advanceTimersByTimeAsync(2000);

    await chromeStoreB.setEntries({ theKey: 'B' });
    expect(await chromeStoreA.entries()).toEqual({ theKey: 'A' });
    expect(await chromeStoreA.isExpired()).toBe(true);
    expect(await chromeStoreB.entries()).toEqual({ theKey: 'B' });
    expect(await chromeStoreB.isExpired()).toBe(false);
  });
});
