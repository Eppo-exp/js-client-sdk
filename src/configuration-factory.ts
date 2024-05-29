import {
  Flag,
  HybridConfigurationStore,
  IAsyncStore,
  IConfigurationStore,
  MemoryOnlyConfigurationStore,
  MemoryStore,
} from '@eppo/js-client-sdk-common';

import { ChromeStorageAsyncStore } from './chrome.configuration-store';
import { LocalStorageBackedAsyncStore } from './local-storage';

export function configurationStorageFactory(
  {
    hasChromeStorage = false,
    hasWindowLocalStorage = false,
    persistentStore = undefined,
    forceMemoryOnly = false,
  }: {
    hasChromeStorage?: boolean;
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
    return new HybridConfigurationStore(new MemoryStore<Flag>(), persistentStore);
  } else if (hasChromeStorage && chromeStorage) {
    // Chrome storage is available, use it as a fallback
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new ChromeStorageAsyncStore<Flag>(chromeStorage, storageKeySuffix ?? ''),
    );
  } else if (hasWindowLocalStorage && windowLocalStorage) {
    // window.localStorage is available, use it as a fallback
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new LocalStorageBackedAsyncStore<Flag>(windowLocalStorage, storageKeySuffix ?? ''),
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
