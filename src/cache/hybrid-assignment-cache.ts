import { AssignmentCache } from '@eppo/js-client-sdk-common';
import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

/** An {@link AssignmentCache} that can write (set) multiple entries at once (in bulk). */
export type BulkWriteAssignmentCache = AssignmentCache & {
  /** Sets all entries in the cache to the provided array of [key, value] pairs. */
  setEntries(entries: [string, string][]): void;
};

/** An {@link AssignmentCache} that can read (get) all entries at once. */
export type BulkReadAssignmentCache = AssignmentCache & {
  /** Returns all entries in the cache as an array of [key, value] pairs. */
  getEntries(): Promise<[string, string][]>;
};

/**
 * An {@link AssignmentCache} implementation that, upon `init`, reads from a persistent and async {@link BulkReadAssignmentCache}
 * and writes to a synchronous {@link BulkWriteAssignmentCache} for serving the cache.
 * */
export default class HybridAssignmentCache implements AssignmentCache {
  constructor(
    private readonly servingStore: BulkWriteAssignmentCache,
    private readonly persistentStore: BulkReadAssignmentCache,
  ) {}

  async init(): Promise<void> {
    const entries = await this.persistentStore.getEntries();
    if (entries) {
      this.servingStore.setEntries(entries);
    }
  }

  set(key: AssignmentCacheKey): void {
    this.servingStore.set(key);
    this.persistentStore.set(key);
  }

  has(key: AssignmentCacheKey): boolean {
    return this.servingStore.has(key);
  }
}
