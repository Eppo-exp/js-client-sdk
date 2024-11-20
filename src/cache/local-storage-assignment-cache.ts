import { AbstractAssignmentCache } from '@eppo/js-client-sdk-common';

import { BulkReadAssignmentCache, BulkWriteAssignmentCache } from './hybrid-assignment-cache';
import { LocalStorageAssignmentShim } from './local-storage-assignment-shim';

export class LocalStorageAssignmentCache
  extends AbstractAssignmentCache<LocalStorageAssignmentShim>
  implements BulkReadAssignmentCache, BulkWriteAssignmentCache
{
  constructor(storageKeySuffix: string) {
    super(new LocalStorageAssignmentShim(storageKeySuffix));
  }

  setEntries(entries: [string, string][]): void {
    entries.forEach(([key, value]) => {
      if (key && value) {
        this.delegate.set(key, value);
      }
    });
  }

  getEntries(): Promise<[string, string][]> {
    return Promise.resolve(Array.from(this.entries()));
  }
}
