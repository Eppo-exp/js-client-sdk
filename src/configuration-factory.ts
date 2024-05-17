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
  persistentStore?: IAsyncStore<Flag>,
  forceMemoryOnly = false,
): IConfigurationStore<Flag> {
  if (forceMemoryOnly) {
    return new MemoryOnlyConfigurationStore();
  } else if (persistentStore) {
    return new HybridConfigurationStore(new MemoryStore<Flag>(), persistentStore);
  } else if (hasChromeStorage()) {
    // Chrome storage is available, use it as a fallback
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new ChromeStorageAsyncStore<Flag>(chrome.storage.local),
    );
  } else if (hasWindowLocalStorage()) {
    // window.localStorage is available, use it as a fallback
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new LocalStorageBackedAsyncStore<Flag>(window.localStorage),
    );
  }

  // No persistence store available, use memory only
  return new MemoryOnlyConfigurationStore();
}

export function hasChromeStorage(): boolean {
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
