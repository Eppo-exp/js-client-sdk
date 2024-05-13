import {
  Flag,
  IConfigurationStore,
  HybridConfigurationStore,
  MemoryStore,
  MemoryOnlyConfigurationStore,
  IAsyncStore,
} from '@eppo/js-client-sdk-common';

import { ChromeStore } from './chrome-storage';
import { LocalStorageBackedAsyncStore } from './local-storage';

export function configurationStorageFactory(
  persistenceStore: IAsyncStore<Flag>,
): IConfigurationStore<Flag> {
  if (persistenceStore) {
    // If a persistence store is provided, use it.
    return new HybridConfigurationStore(new MemoryStore<Flag>(), persistenceStore);
  } else if (hasChromeStorageAvailable()) {
    // prefer chrome.storage.local
    return createChromeStorageConfigurationStore();
  } else if (hasWindowLocalStorage()) {
    // fallback to window.localStorage if available
    return createLocalStorageConfigurationStore();
  }

  return new MemoryOnlyConfigurationStore();
}

export function hasChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled and you try to access it
    return false;
  }
}

export function createChromeStorageConfigurationStore() {
  return new HybridConfigurationStore(
    new MemoryStore<Flag>(),
    new ChromeStore<Flag>(chrome.storage.local),
  );
}

export function createLocalStorageConfigurationStore() {
  return new HybridConfigurationStore(
    new MemoryStore<Flag>(),
    new LocalStorageBackedAsyncStore<Flag>(window.localStorage),
  );
}
