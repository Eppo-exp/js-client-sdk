import { ChromeStore } from './chrome-storage';

describe('ChromeStore', () => {
  let chromeStore: ChromeStore<any>;
  const mockEntries = { key1: 'value1', key2: 'value2' };

  beforeEach(() => {
    const extendedStorageLocal: chrome.storage.StorageArea = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(),
      setAccessLevel: jest.fn(),
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
        getRules: jest.fn(),
        removeRules: jest.fn(),
        addRules: jest.fn(),
        hasListeners: jest.fn(),
      },
    };
    chromeStore = new ChromeStore(extendedStorageLocal);
  });

  afterAll(() => {
    // getItemSpy.mockRestore();
    // setItemSpy.mockRestore();
  });

  it('is always expired', async () => {
    expect(await chromeStore.isExpired()).toBe(true);
  });

  it('should be initialized after setting entries', async () => {
    await chromeStore.setEntries(mockEntries);
    expect(chromeStore.isInitialized()).toBe(true);
  });

  it('should get entries correctly after setting them', async () => {
    await chromeStore.setEntries(mockEntries);
    const entries = await chromeStore.getEntries();
    expect(entries).toEqual(mockEntries);
  });
});
