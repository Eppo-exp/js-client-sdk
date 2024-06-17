import {
  AbstractAssignmentCache,
  NonExpiringInMemoryAssignmentCache,
} from '@eppo/js-client-sdk-common';
import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

import { BulkReadAssignmentCache, BulkWriteAssignmentCache } from './hybrid-assignment-cache';

/** An {@link BulkWriteAssignmentCache} assignment cache backed by an in-memory {@link Map} */
export default class SimpleAssignmentCache
  implements BulkWriteAssignmentCache, BulkReadAssignmentCache
{
  private readonly store: Map<string, string>;
  private readonly cache: AbstractAssignmentCache<Map<string, string>>;

  constructor() {
    this.store = new Map<string, string>();
    this.cache = new NonExpiringInMemoryAssignmentCache(this.store);
  }

  set(key: AssignmentCacheKey): void {
    this.cache.set(key);
  }

  has(key: AssignmentCacheKey): boolean {
    return this.cache.has(key);
  }

  setEntries(entries: [string, string][]): void {
    const { store } = this;
    // it's important to call store.set() directly here because we want to set the raw entries into the cache, bypassing
    // the AbstractAssignmentCache logic, which takes an AssignmentCacheKey instead.
    entries.forEach(([key, value]) => store.set(key, value));
  }

  getEntries(): Promise<[string, string][]> {
    return Promise.resolve(Array.from(this.cache.entries()));
  }
}
