import { MemoryOnlyConfigurationStore, HybridConfigurationStore } from '@eppo/js-client-sdk-common';

import { ChromeStorageAsyncStore } from './chrome.configuration-store';
import { configurationStorageFactory } from './configuration-factory';
import { LocalStorageBackedAsyncStore } from './local-storage';

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
      getEntries: jest.fn().mockReturnValue({}),
      setEntries: jest.fn(),
    };
    const result = configurationStorageFactory({
      persistentStore: mockPersistentStore,
    });
    expect(result).toBeInstanceOf(HybridConfigurationStore);
    expect(result.persistentStore).toBe(mockPersistentStore);
  });

  it('is a HybridConfigurationStore with a ChromeStorageAsyncStore persistentStore when chrome storage is available', () => {
    const mockChromeStorageLocal = {
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
    expect(result.persistentStore).toBeInstanceOf(ChromeStorageAsyncStore);
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
    expect(result.persistentStore).toBeInstanceOf(LocalStorageBackedAsyncStore);
  });

  it('falls back to MemoryOnlyConfigurationStore when no persistence options are available', () => {
    const result = configurationStorageFactory({});
    expect(result).toBeInstanceOf(MemoryOnlyConfigurationStore);
  });
});
