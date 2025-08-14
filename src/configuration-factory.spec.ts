import { HybridConfigurationStore, MemoryOnlyConfigurationStore } from '@eppo/js-client-sdk-common';

import { configurationStorageFactory } from './configuration-factory';

describe('configurationStorageFactory', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forces a MemoryOnlyConfigurationStore', () => {
    const result = configurationStorageFactory({ forceMemoryOnly: true });
    expect(result).toBeInstanceOf(MemoryOnlyConfigurationStore);
  });

  it('is a provided persistentStore', () => {
    const mockPersistentStore = {
      get: jest.fn(),
      set: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      isExpired: jest.fn().mockReturnValue(false),
      entries: jest.fn().mockReturnValue({}),
      setEntries: jest.fn(),
    };
    const result = configurationStorageFactory({
      persistentStore: mockPersistentStore,
    });
    expect(result).toBeInstanceOf(HybridConfigurationStore);
  });

  it('is a HybridConfigurationStore with a ChromeStorageAsyncStore persistentStore when chrome storage is available', () => {
    const mockChromeStorageLocal = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn(),
      setAccessLevel: jest.fn(),
      getKeys: jest.fn(),
      onChanged: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
        hasListener: jest.fn(),
        dispatch: jest.fn(),
        getRules: jest.fn(),
        removeRules: jest.fn(),
        addRules: jest.fn(),
        hasListeners: jest.fn(),
      },
    };

    const result = configurationStorageFactory(
      { hasChromeStorage: true },
      { chromeStorage: mockChromeStorageLocal },
    );
    expect(result).toBeInstanceOf(HybridConfigurationStore);
  });

  it('is a HybridConfigurationStore with Web Cache API when hasWebCacheAPI is true', () => {
    // Mock caches API
    const mockCache = {
      match: jest.fn(),
      put: jest.fn(),
    };
    const mockCaches = {
      open: jest.fn().mockResolvedValue(mockCache),
      delete: jest.fn(),
    };
    global.caches = mockCaches;

    const mockLocalStorage = {
      clear: jest.fn(),
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    const result = configurationStorageFactory(
      { hasWebCacheAPI: true },
      { windowLocalStorage: mockLocalStorage },
    );
    expect(result).toBeInstanceOf(HybridConfigurationStore);

    // Clean up
    delete global.caches;
  });

  it('is a HybridConfigurationStore with a LocalStorageBackedAsyncStore persistentStore when window local storage is available', () => {
    const mockLocalStorage = {
      clear: jest.fn(),
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    const result = configurationStorageFactory(
      { hasWindowLocalStorage: true },
      { windowLocalStorage: mockLocalStorage },
    );
    expect(result).toBeInstanceOf(HybridConfigurationStore);
  });

  it('prefers Web Cache API over localStorage when both are available', () => {
    // Mock caches API
    const mockCache = {
      match: jest.fn(),
      put: jest.fn(),
    };
    const mockCaches = {
      open: jest.fn().mockResolvedValue(mockCache),
      delete: jest.fn(),
    };
    global.caches = mockCaches;

    const mockLocalStorage = {
      clear: jest.fn(),
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    const result = configurationStorageFactory(
      { hasWebCacheAPI: true, hasWindowLocalStorage: true },
      { windowLocalStorage: mockLocalStorage },
    );
    expect(result).toBeInstanceOf(HybridConfigurationStore);

    // Clean up
    delete global.caches;
  });

  it('falls back to MemoryOnlyConfigurationStore when no persistence options are available', () => {
    const result = configurationStorageFactory({});
    expect(result).toBeInstanceOf(MemoryOnlyConfigurationStore);
  });
});
