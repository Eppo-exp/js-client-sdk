import {
  Flag,
  IAsyncStore,
  IConfigurationStore,
  IObfuscatedPrecomputedBandit,
  ISyncStore,
  MemoryOnlyConfigurationStore,
  MemoryStore,
  PrecomputedFlag,
  Variation,
} from '@eppo/js-client-sdk-common';

import ChromeStorageAsyncMap from './cache/chrome-storage-async-map';
import { ChromeStorageEngine } from './chrome-storage-engine';
import { ConfigurationAsyncStore } from './configuration-store';
import {
  IsolatableHybridConfigurationStore,
  ServingStoreUpdateStrategy,
} from './isolatable-hybrid.store';
import { LocalStorageEngine } from './local-storage-engine';
import { MigrationManager } from './migrations';
import { OVERRIDES_KEY } from './storage-key-constants';
import { StringValuedAsyncStore } from './string-valued.store';
import { WebCacheStorageEngine } from './web-cache-storage-engine';

export function precomputedFlagsStorageFactory(): IConfigurationStore<PrecomputedFlag> {
  return new MemoryOnlyConfigurationStore();
}

export function precomputedBanditStoreFactory(): IConfigurationStore<IObfuscatedPrecomputedBandit> {
  return new MemoryOnlyConfigurationStore();
}

export function configurationStorageFactory(
  {
    maxAgeSeconds = 0,
    servingStoreUpdateStrategy = 'always',
    hasChromeStorage = false,
    hasWebCacheAPI = false,
    hasWindowLocalStorage = false,
    persistentStore = undefined,
    forceMemoryOnly = false,
  }: {
    maxAgeSeconds?: number;
    servingStoreUpdateStrategy?: ServingStoreUpdateStrategy;
    hasChromeStorage?: boolean;
    hasWebCacheAPI?: boolean;
    hasWindowLocalStorage?: boolean;
    persistentStore?: IAsyncStore<Flag>;
    forceMemoryOnly?: boolean;
  },
  {
    chromeStorage,
    windowLocalStorage,
    storageKeySuffix,
  }: {
    chromeStorage?: chrome.storage.StorageArea;
    windowLocalStorage?: Storage;
    storageKeySuffix?: string;
  } = {},
): IConfigurationStore<Flag> {
  if (forceMemoryOnly) {
    return new MemoryOnlyConfigurationStore();
  } else if (persistentStore) {
    return new IsolatableHybridConfigurationStore(
      new MemoryStore<Flag>(),
      persistentStore,
      servingStoreUpdateStrategy,
    );
  } else if (hasChromeStorage && chromeStorage) {
    // Chrome storage is available, use it as a fallback
    const chromeStorageEngine = new ChromeStorageEngine(
      new ChromeStorageAsyncMap(chromeStorage),
      storageKeySuffix ?? '',
    );
    return new IsolatableHybridConfigurationStore(
      new MemoryStore<Flag>(),
      new StringValuedAsyncStore<Flag>(chromeStorageEngine, maxAgeSeconds),
      servingStoreUpdateStrategy,
    );
  } else if (hasWebCacheAPI) {
    // Web Cache API is available and preferred for better storage limits
    // Run migration from localStorage to Cache API only if localStorage exists
    if (windowLocalStorage) {
      const migrationManager = new MigrationManager(windowLocalStorage);
      migrationManager
        .runPendingMigrations()
        .catch((error) => console.warn('Storage migration failed:', error));
    }

    const webCacheEngine = new WebCacheStorageEngine(storageKeySuffix ?? '');
    return new IsolatableHybridConfigurationStore(
      new MemoryStore<Flag>(),
      new ConfigurationAsyncStore<Flag>(webCacheEngine, maxAgeSeconds),
      servingStoreUpdateStrategy,
    );
  } else if (hasWindowLocalStorage && windowLocalStorage) {
    // window.localStorage is available, use it as a fallback
    const localStorageEngine = new LocalStorageEngine(windowLocalStorage, storageKeySuffix ?? '');
    return new IsolatableHybridConfigurationStore(
      new MemoryStore<Flag>(),
      new StringValuedAsyncStore<Flag>(localStorageEngine, maxAgeSeconds),
      servingStoreUpdateStrategy,
    );
  }

  // No persistence store available, use memory only
  return new MemoryOnlyConfigurationStore();
}

export function overrideStorageFactory(
  {
    hasWindowLocalStorage = false,
    forceMemoryOnly = false,
  }: {
    hasWindowLocalStorage?: boolean;
    forceMemoryOnly?: boolean;
  },
  {
    windowLocalStorage,
    storageKey = OVERRIDES_KEY,
  }: {
    windowLocalStorage?: Storage;
    storageKey?: string;
  } = {},
): ISyncStore<Variation> {
  const memoryStore = new MemoryStore<Variation>();
  if (!forceMemoryOnly && hasWindowLocalStorage && windowLocalStorage) {
    const localStorageContents = windowLocalStorage.getItem(storageKey);
    if (localStorageContents) {
      const parsedContents = JSON.parse(localStorageContents);
      memoryStore.setEntries(parsedContents);
    }
  }
  return memoryStore;
}

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

export function chromeStorageIfAvailable(): chrome.storage.StorageArea | undefined {
  return hasChromeStorage() ? chrome.storage.local : undefined;
}

/** Returns whether `window.localStorage` is available */
export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled, and you try to access it
    return false;
  }
}

export function localStorageIfAvailable(): Storage | undefined {
  return hasWindowLocalStorage() ? window.localStorage : undefined;
}

/** Returns whether Web Cache API is available */
export function hasWebCacheAPI(): boolean {
  try {
    return typeof caches !== 'undefined' && typeof caches.open === 'function';
  } catch {
    // Some environments may throw when accessing caches
    return false;
  }
}
