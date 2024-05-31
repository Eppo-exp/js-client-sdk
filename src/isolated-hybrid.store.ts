import { HybridConfigurationStore, IAsyncStore, ISyncStore } from '@eppo/js-client-sdk-common';

export type ServingStoreUpdateStrategy = 'always' | 'expired' | 'never';

/**
 * Extension of the HybridConfigurationStore that allows isolating the serving store from updates.
 * This could be useful when you want to avoid updating the serving store to maintain greater
 * consistency within a session, but still want to update the cache for a quick, updated
 * initialization the next session.
 */
export class IsolatedHybridConfigurationStore<T> extends HybridConfigurationStore<T> {
  constructor(
    servingStore: ISyncStore<T>,
    persistentStore: IAsyncStore<T> | null,
    private servingStoreUpdateStrategy: ServingStoreUpdateStrategy = 'always',
  ) {
    super(servingStore, persistentStore);
  }

  /** @Override */
  public async setEntries(entries: Record<string, T>): Promise<void> {
    if (this.persistentStore) {
      // always update persistent store
      await this.persistentStore.setEntries(entries);
    }
    const persistentStoreIsExpired =
      !this.persistentStore || (await this.persistentStore.isExpired());
    const updateServingStore =
      this.servingStoreUpdateStrategy === 'always' ||
      (this.servingStoreUpdateStrategy === 'expired' && persistentStoreIsExpired);

    if (updateServingStore) {
      this.servingStore.setEntries(entries);
    }
  }
}
