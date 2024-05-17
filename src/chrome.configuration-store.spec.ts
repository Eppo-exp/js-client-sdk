import { ChromeStorageAsyncStore } from './chrome.configuration-store';

describe('ChromeStore', () => {
  const mockEntries: Record<string, string> = { key1: 'value1', key2: 'value2' };
  let chromeStore: ChromeStorageAsyncStore<string>;
  let extendedStorageLocal: chrome.storage.StorageArea;

  beforeEach(() => {
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
    jest.clearAllMocks();
  });

  it('is always expired', async () => {
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('should return null when no entries are found', async () => {
    (extendedStorageLocal.get as jest.Mock).mockImplementation(() => {
      return Promise.resolve({});
    });

    const entries = await chromeStore.getEntries();
    expect(entries).toBeNull();
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
