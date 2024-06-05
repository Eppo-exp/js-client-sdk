import {
  Flag,
  IAsyncStore,
  IConfigurationStore,
  MemoryOnlyConfigurationStore,
  MemoryStore,
} from '@eppo/js-client-sdk-common';

import {
  IsolatedHybridConfigurationStore,
  ServingStoreUpdateStrategy,
} from './isolated-hybrid.store';
import { LocalStorageAsyncStore } from './local-storage.store';

import { ChromeStorageAsyncStore } from '.';

export function configurationStorageFactory(
  {
    maxAgeSeconds = 0,
    servingStoreUpdateStrategy = 'always',
    hasChromeStorage = false,
    hasWindowLocalStorage = false,
    persistentStore = undefined,
    forceMemoryOnly = false,
  }: {
    maxAgeSeconds?: number;
    servingStoreUpdateStrategy?: ServingStoreUpdateStrategy;
    hasChromeStorage?: boolean;
    hasWindowLocalStorage?: boolean;
    persistentStore?: IAsyncStore<Flag>;
    forceMemoryOnly?: boolean;
  },
  {
    chromeStorage,
    windowLocalStorage,
  }: { chromeStorage?: chrome.storage.StorageArea; windowLocalStorage?: Storage } = {},
): IConfigurationStore<Flag> {
  if (forceMemoryOnly) {
    return new MemoryOnlyConfigurationStore();
  } else if (persistentStore) {
    return new IsolatedHybridConfigurationStore(
      new MemoryStore<Flag>(),
      persistentStore,
      servingStoreUpdateStrategy,
    );
  } else if (hasChromeStorage && chromeStorage) {
    // Chrome storage is available, use it as a fallback
    return new IsolatedHybridConfigurationStore(
      new MemoryStore<Flag>(),
      ChromeStorageAsyncStore.createStringValuedStore(chromeStorage, maxAgeSeconds),
      servingStoreUpdateStrategy,
    );
  } else if (hasWindowLocalStorage && windowLocalStorage) {
    // window.localStorage is available, use it as a fallback
    return new IsolatedHybridConfigurationStore(
      new MemoryStore<Flag>(),
      LocalStorageAsyncStore.createStringValuedStore(localStorage, maxAgeSeconds),
      servingStoreUpdateStrategy,
    );
  }

  // No persistence store available, use memory only
  return new MemoryOnlyConfigurationStore();
}

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled, and you try to access it
    return false;
  }
}
