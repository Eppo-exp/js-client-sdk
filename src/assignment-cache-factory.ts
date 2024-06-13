import { AssignmentCache } from '../../js-client-sdk-common/src';

import ChromeStorageAssignmentCache from './cache/chrome-storage-assignment-cache';
import HybridAssignmentCache from './cache/hybrid-assignment-cache';
import { LocalStorageAssignmentCache } from './cache/local-storage-assignment-cache';

export function assignmentCacheFactory({
  chromeStorage,
  apiKey,
}: {
  apiKey: string;
  chromeStorage?: chrome.storage.StorageArea;
}): AssignmentCache {
  // Note that we use the first 8 characters of the API key to create per-API key persistent storages and caches
  const storageKeySuffix = apiKey.replace(/\W/g, '').substring(0, 8);
  const localStorageCache = new LocalStorageAssignmentCache(storageKeySuffix);
  if (chromeStorage) {
    const chromeStorageCache = new ChromeStorageAssignmentCache(chromeStorage);
    return new HybridAssignmentCache(localStorageCache, chromeStorageCache);
  } else {
    return localStorageCache;
  }
}
