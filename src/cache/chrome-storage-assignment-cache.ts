import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

import ChromeStorageAsyncMap from './chrome-storage-async-map';
import { BulkReadAssignmentCache } from './hybrid-assignment-cache';

export default class ChromeStorageAssignmentCache implements BulkReadAssignmentCache {
  private readonly storage: ChromeStorageAsyncMap<AssignmentCacheKey>;

  constructor(chromeStorage: chrome.storage.StorageArea) {
    this.storage = new ChromeStorageAsyncMap(chromeStorage);
  }

  set(entry: AssignmentCacheKey): void {
    const { subjectKey, flagKey, allocationKey } = entry;
    const key = [`subject:${subjectKey}`, `flag:${flagKey}`, `allocation:${allocationKey}`].join(
      ';',
    );
    // "fire-and-forget" - we intentionally don't wait for the promise to resolve
    // noinspection JSIgnoredPromiseFromCall
    this.storage.set(key, entry);
  }

  has(_: AssignmentCacheKey): boolean {
    throw new Error('Method not implemented, use getEntries() instead.');
  }

  async getEntries(): Promise<AssignmentCacheKey[]> {
    const entries = await this.storage.entries();
    return Object.values(entries);
  }
}
