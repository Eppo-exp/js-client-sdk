import { AssignmentCache } from '@eppo/js-client-sdk-common';

import { hasIndexedDB, hasWindowLocalStorage } from '../configuration-factory';

import ChromeStorageAssignmentCache from './chrome-storage-assignment-cache';
import HybridAssignmentCache from './hybrid-assignment-cache';
import { IndexedDBAssignmentCache } from './indexed-db-assignment-cache';
import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';
import SimpleAssignmentCache from './simple-assignment-cache';

export function assignmentCacheFactory({
  forceMemoryOnly = false,
  useIndexedDB = false,
  chromeStorage,
  storageKeySuffix,
}: {
  forceMemoryOnly?: boolean;
  useIndexedDB?: boolean;
  storageKeySuffix: string;
  chromeStorage?: chrome.storage.StorageArea;
}): AssignmentCache {
  const simpleCache = new SimpleAssignmentCache();

  if (forceMemoryOnly) {
    return simpleCache;
  }

  // Priority order: Chrome storage > IndexedDB (if opted in) > localStorage > memory-only
  if (chromeStorage) {
    const chromeStorageCache = new ChromeStorageAssignmentCache(chromeStorage);
    return new HybridAssignmentCache(simpleCache, chromeStorageCache);
  } else if (useIndexedDB && hasIndexedDB()) {
    // IndexedDB is available and user has opted in
    const indexedDBCache = new IndexedDBAssignmentCache(storageKeySuffix);
    return new HybridAssignmentCache(simpleCache, indexedDBCache);
  } else if (hasWindowLocalStorage()) {
    const localStorageCache = new LocalStorageAssignmentCache(storageKeySuffix);
    return new HybridAssignmentCache(simpleCache, localStorageCache);
  } else {
    return simpleCache;
  }
}
