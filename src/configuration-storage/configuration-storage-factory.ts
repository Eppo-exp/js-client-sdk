import {
  Flag,
  IConfigurationStore,
  HybridConfigurationStore,
  MemoryStore,
  MemoryOnlyConfigurationStore,
} from '@eppo/js-client-sdk-common';

import { ChromeStore } from './chrome-storage';
import { LocalStorageBackedAsyncStore } from './local-storage';

export function configurationStorageFactory(): IConfigurationStore<Flag> {
  // prefer chrome.storage.local
  if (isChromeStorageAvailable()) {
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new ChromeStore<Flag>(chrome.storage.local),
    );
  } else if (hasWindowLocalStorage()) {
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new LocalStorageBackedAsyncStore<Flag>(window.localStorage),
    );
  }

  return new MemoryOnlyConfigurationStore();
}

export function isChromeStorageAvailable() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled and you try to access it
    return false;
  }
}
