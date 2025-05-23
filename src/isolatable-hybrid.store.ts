import { HybridConfigurationStore, IAsyncStore, ISyncStore } from '@eppo/js-client-sdk-common';

export type ServingStoreUpdateStrategy = 'always' | 'expired' | 'empty';

/**
 * Extension of AsyncStore where its aware it's paired with a SyncStore.
 * Useful when providing custom persistent stores.
 */
export interface IPairedAsyncStore<T> extends IAsyncStore<T> {
  // If available, will be called when HybridConfigurationStore is constructed to provide a rehydration hook for the serving store
  registerRehydrate?(rehydrate: (entries?: Record<string, T>) => Promise<void>): void;
}

/**
 * Extension of the HybridConfigurationStore that allows optionally isolating the serving store from
 * updates.
 * This could be useful when you want to avoid updating the serving store to maintain greater
 * consistency within a session, but still want to update the cache for a quick, updated
 * initialization the next session.
 */
export class IsolatableHybridConfigurationStore<T> extends HybridConfigurationStore<T> {
  constructor(
    servingStore: ISyncStore<T>,
    persistentStore: IPairedAsyncStore<T> | null,
    private servingStoreUpdateStrategy: ServingStoreUpdateStrategy = 'always',
  ) {
    super(servingStore, persistentStore);

    // Register hook if available
    if (persistentStore?.registerRehydrate) {
      persistentStore.registerRehydrate(this.rehydrate.bind(this));
    }
  }

  /** @Override */
  public async setEntries(entries: Record<string, T>): Promise<boolean> {
    if (this.persistentStore) {
      // always update persistent store
      await this.persistentStore.setEntries(entries);
    }

    const persistentStoreIsExpired =
      !this.persistentStore || (await this.persistentStore.isExpired());
    const servingStoreIsEmpty = !this.servingStore.getKeys()?.length;

    // Update the serving store based on the update strategy:
    // "always" - always update the serving store
    // "expired" - only update if the persistent store is expired
    // "empty" - only update if the persistent store is expired and the serving store is empty
    const updateServingStore =
      this.servingStoreUpdateStrategy === 'always' ||
      (persistentStoreIsExpired && this.servingStoreUpdateStrategy === 'expired') ||
      (persistentStoreIsExpired && servingStoreIsEmpty);

    if (updateServingStore) {
      this.setServingStoreEntries(entries);
    }
    return updateServingStore;
  }

  /**
   * Hook to rehydrate serving store entries either from the persistent store or explicitly.
   * Useful for manually triggering a serving store update when the upstate strategy is not set to always.
   */
  private async rehydrate(entries?: Record<string, T>): Promise<void> {
    const entriesToSet =
      entries ?? (this.persistentStore ? await this.persistentStore.entries() : undefined);
    if (entriesToSet) {
      // Only rehydrate if we have a source
      this.setServingStoreEntries(entriesToSet);
    }
  }

  private setServingStoreEntries(entries: Record<string, T>): void {
    this.servingStore.setEntries(entries);
  }
}
