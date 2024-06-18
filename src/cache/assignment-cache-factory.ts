import { AssignmentCache } from '@eppo/js-client-sdk-common';

import { hasWindowLocalStorage } from '../configuration-factory';

import ChromeStorageAssignmentCache from './chrome-storage-assignment-cache';
import HybridAssignmentCache from './hybrid-assignment-cache';
import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';
import SimpleAssignmentCache from './simple-assignment-cache';

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
