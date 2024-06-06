import { IAsyncStore } from '@eppo/js-client-sdk-common';

import { ChromeStorageEngine } from './chrome-storage-engine';
import { StringValuedAsyncStore } from './string-valued.store';

import StorageArea = chrome.storage.StorageArea;

describe('ChromeStorageStore', () => {
  const mockEntries: Record<string, string> = { key1: 'value1', key2: 'value2' };
  const storageGetFake = jest.fn();
  const chromeStorageEngine = new ChromeStorageEngine({
    get: storageGetFake,
    set: jest.fn(),
  } as unknown as StorageArea);
  let chromeStore: IAsyncStore<unknown>;
  let now: number;

  beforeEach(() => {
    now = Date.now();
    jest.useFakeTimers();
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

    storageGetFake.mockImplementation(() => {
      return Promise.resolve({
        ['eppo-configuration']: JSON.stringify(mockEntries),
        ['eppo-configuration-meta']: JSON.stringify({
          lastUpdatedAtMs: new Date().getTime(),
        }),
      });
    });

    expect(await chromeStore.isExpired()).toBe(false);
  });

  it('is expired after cooldown', async () => {
    chromeStore = new StringValuedAsyncStore(chromeStorageEngine, 10);

    storageGetFake.mockImplementation(() => {
      return Promise.resolve({
        ['eppo-configuration']: JSON.stringify(mockEntries),
        ['eppo-configuration-meta']: JSON.stringify({
          lastUpdatedAtMs: now,
        }),
      });
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
    storageGetFake.mockImplementation(() => {
      return Promise.resolve({ ['eppo-configuration']: JSON.stringify(mockEntries) });
    });

    const entries = await chromeStore.getEntries();
    expect(entries).toEqual(mockEntries);
  });

  it('stores independently based on key suffix', async () => {
    const chromeStoreA = new ChromeStorageAsyncStore(extendedStorageLocal, 'A', 1);
    const chromeStoreB = new ChromeStorageAsyncStore(extendedStorageLocal, 'B', 1);

    await chromeStoreA.setEntries({ theKey: 'A' });
    expect(await chromeStoreA.getEntries()).toEqual({ theKey: 'A' });
    expect(await chromeStoreA.isExpired()).toBe(false);
    expect(await chromeStoreB.getEntries()).toEqual({});
    expect(await chromeStoreB.isExpired()).toBe(true);

    await jest.advanceTimersByTimeAsync(2000);

    await chromeStoreB.setEntries({ theKey: 'B' });
    expect(await chromeStoreA.getEntries()).toEqual({ theKey: 'A' });
    expect(await chromeStoreA.isExpired()).toBe(true);
    expect(await chromeStoreB.getEntries()).toEqual({ theKey: 'B' });
    expect(await chromeStoreB.isExpired()).toBe(false);
  });
});
