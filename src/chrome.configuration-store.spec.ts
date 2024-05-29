import { ChromeStorageAsyncStore } from './chrome.configuration-store';

describe('ChromeStore', () => {
  const mockEntries: Record<string, string> = { key1: 'value1', key2: 'value2' };
  let chromeStore: ChromeStorageAsyncStore<string>;
  let extendedStorageLocal: chrome.storage.StorageArea;
  let now: number;

  beforeEach(() => {
    now = Date.now();

    jest.useFakeTimers();

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

    extendedStorageLocal = {
      set,
      get,
      clear: jest.fn(),
      remove: jest.fn(),
      getBytesInUse: jest.fn(),
      setAccessLevel: jest.fn(),
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        getRules: jest.fn(),
        hasListener: jest.fn(),
        removeRules: jest.fn(),
        addRules: jest.fn(),
        hasListeners: jest.fn(),
      },
    };

    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, '');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('is always expired without cooldown', async () => {
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, '');
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('is not expired with cooldown', async () => {
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, '', 10);

    (extendedStorageLocal.get as jest.Mock).mockImplementation(() => {
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
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, '', 10);

    (extendedStorageLocal.get as jest.Mock).mockImplementation(() => {
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
    (extendedStorageLocal.get as jest.Mock).mockImplementation(() => {
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
