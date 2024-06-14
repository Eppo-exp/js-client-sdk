import { NonExpiringInMemoryAssignmentCache } from '@eppo/js-client-sdk-common';
import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

import { BulkReadAssignmentCache, BulkWriteAssignmentCache } from './hybrid-assignment-cache';

/** An {@link BulkWriteAssignmentCache} assignment cache backed by an in-memory {@link Map} */
export default class SimpleAssignmentCache
  implements BulkWriteAssignmentCache, BulkReadAssignmentCache
{
  constructor(private readonly cache = new NonExpiringInMemoryAssignmentCache()) {}

  set(key: AssignmentCacheKey): void {
    this.cache.set(key);
  }

  has(key: AssignmentCacheKey): boolean {
    return this.cache.has(key);
  }

  setEntries(entries: AssignmentCacheKey[]): void {
    entries.forEach((entry) => this.set(entry));
  }

  getEntries(): Promise<AssignmentCacheKey[]> {
    return Promise.resolve([] /** this.cache.keys() */);
  }
}
