import {
  Flag,
  HybridConfigurationStore,
  IAsyncStore,
  IConfigurationStore,
  MemoryOnlyConfigurationStore,
  MemoryStore,
} from '@eppo/js-client-sdk-common';

import { LocalStorageBackedAsyncStore } from './local-storage';

export function configurationStorageFactory(
  persistenceStore?: IAsyncStore<Flag>,
  forceMemoryOnly = false,
): IConfigurationStore<Flag> {
  if (forceMemoryOnly) {
    console.log('(forced): Using memory-only configuration store.');
    return new MemoryOnlyConfigurationStore();
  } else if (persistenceStore) {
    console.log('(persistenceStore): Using user-provided configuration store.');
    return new HybridConfigurationStore(new MemoryStore<Flag>(), persistenceStore);
  } else if (hasWindowLocalStorage()) {
    console.log('(localStorage): Using window.localStorage configuration store.');
    // fallback to window.localStorage if available
    return new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new LocalStorageBackedAsyncStore<Flag>(window.localStorage),
    );
  }

  console.log('(fallback): Using memory-only configuration store.');
  return new MemoryOnlyConfigurationStore();
}

export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled and you try to access it
    return false;
  }
}
