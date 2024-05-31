import { ChromeStorageAsyncStore } from './chrome-storage.store';

describe('ChromeConfigurationStore', () => {
  const mockEntries: Record<string, string> = { key1: 'value1', key2: 'value2' };
  let chromeStore: ChromeStorageAsyncStore<string>;
  let extendedStorageLocal: chrome.storage.StorageArea;
  let now: number;

  beforeEach(() => {
    now = Date.now();

    jest.useFakeTimers();

    const get = jest.fn();
    const set = jest.fn();
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

    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('is always expired without cooldown', async () => {
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, undefined);
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('is not expired with cooldown', async () => {
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, 10);

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
    chromeStore = new ChromeStorageAsyncStore(extendedStorageLocal, 10);

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
});
