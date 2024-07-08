import {
  assignmentCacheKeyToString,
  assignmentCacheValueToString,
  AssignmentCacheEntry,
} from '@eppo/js-client-sdk-common';

import ChromeStorageAsyncMap from './chrome-storage-async-map';
import { BulkReadAssignmentCache } from './hybrid-assignment-cache';

export default class ChromeStorageAssignmentCache implements BulkReadAssignmentCache {
  private readonly storage: ChromeStorageAsyncMap<string>;

  constructor(chromeStorage: chrome.storage.StorageArea) {
    this.storage = new ChromeStorageAsyncMap(chromeStorage);
  }

  set(entry: AssignmentCacheEntry): void {
    // "fire-and-forget" - we intentionally don't wait for the promise to resolve
    // noinspection JSIgnoredPromiseFromCall
    this.storage.set(assignmentCacheKeyToString(entry), assignmentCacheValueToString(entry));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  has(_entry: AssignmentCacheEntry): boolean {
    throw new Error(
      'This should never be called for ChromeStorageAssignmentCache, use getEntries() instead.',
    );
  }

  async getEntries(): Promise<[string, string][]> {
    const entries = await this.storage.entries();
    return Object.entries(entries).map(([key, value]) => [key, value] as [string, string]);
  }
}
