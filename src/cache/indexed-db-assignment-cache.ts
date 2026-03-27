import { AbstractAssignmentCache } from '@eppo/js-client-sdk-common';

import { BulkReadAssignmentCache, BulkWriteAssignmentCache } from './hybrid-assignment-cache';
import { IndexedDBAssignmentShim } from './indexed-db-assignment-shim';

/**
 * IndexedDB-backed assignment cache.
 *
 * Provides persistent storage for assignment results with larger capacity than localStorage.
 * Stores assignments as a blob in IndexedDB for efficient storage and retrieval.
 */
export class IndexedDBAssignmentCache
  extends AbstractAssignmentCache<IndexedDBAssignmentShim>
  implements BulkReadAssignmentCache, BulkWriteAssignmentCache
{
  constructor(storageKeySuffix: string) {
    super(new IndexedDBAssignmentShim(storageKeySuffix));
  }

  setEntries(entries: [string, string][]): void {
    entries.forEach(([key, value]) => {
      if (key && value) {
        this.delegate.set(key, value);
      }
    });
  }

  async getEntries(): Promise<[string, string][]> {
    return Array.from(this.entries());
  }

  /**
   * Initialize the cache by loading from IndexedDB.
   * This should be called during SDK initialization.
   */
  async init(): Promise<void> {
    await this.delegate.init();
  }
}
