import { AssignmentCache } from '@eppo/js-client-sdk-common';
import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

export type WriteableAssignmentCache = AssignmentCache & {
  setEntries(entries: AssignmentCacheKey[]): void;
};

export type ReadableAssignmentCache = AssignmentCache & {
  getEntries(): Promise<AssignmentCacheKey[]>;
};

/**
 * An {@link AssignmentCache} implementation that, upon `init`, reads from a persistent and async {@link ReadableAssignmentCache}
 * and writes to a synchronous {@link WriteableAssignmentCache} for serving the cache.
 * */
export default class HybridAssignmentCache implements AssignmentCache {
  constructor(
    private readonly servingStore: WriteableAssignmentCache,
    private readonly persistentStore: ReadableAssignmentCache,
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
