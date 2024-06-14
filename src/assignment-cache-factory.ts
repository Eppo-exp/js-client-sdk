import { AssignmentCache } from '@eppo/js-client-sdk-common';

import ChromeStorageAssignmentCache from './cache/chrome-storage-assignment-cache';
import HybridAssignmentCache from './cache/hybrid-assignment-cache';
import { LocalStorageAssignmentCache } from './cache/local-storage-assignment-cache';
import SimpleAssignmentCache from './cache/simple-assignment-cache';
import { hasWindowLocalStorage } from './configuration-factory';

export function assignmentCacheFactory({
  chromeStorage,
  storageKeySuffix,
}: {
  storageKeySuffix: string;
  chromeStorage?: chrome.storage.StorageArea;
}): AssignmentCache {
  const hasLocalStorage = hasWindowLocalStorage();
  const simpleCache = new SimpleAssignmentCache();
  if (chromeStorage) {
    const chromeStorageCache = new ChromeStorageAssignmentCache(chromeStorage);
    return new HybridAssignmentCache(simpleCache, chromeStorageCache);
  } else {
    if (hasLocalStorage) {
      const localStorageCache = new LocalStorageAssignmentCache(storageKeySuffix);
      return new HybridAssignmentCache(simpleCache, localStorageCache);
    } else {
      return simpleCache;
    }
  }
}
