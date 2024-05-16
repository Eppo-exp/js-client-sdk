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
  persistenceStore?: IAsyncStore<Flag>,
): IConfigurationStore<Flag> {
  if (persistenceStore) {
    return new HybridConfigurationStore(new MemoryStore<Flag>(), persistenceStore);
  } else if (hasChromeStorage()) {
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new ChromeStorageAsyncStore<Flag>(chrome.storage.local),
    );
  } else if (hasWindowLocalStorage()) {
    // fallback to window.localStorage if available
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new LocalStorageBackedAsyncStore<Flag>(window.localStorage),
    );
  }

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
