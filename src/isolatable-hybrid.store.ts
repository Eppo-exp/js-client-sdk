import { HybridConfigurationStore, IAsyncStore, ISyncStore } from '@eppo/js-client-sdk-common';

export type ServingStoreUpdateStrategy = 'always' | 'expired' | 'empty';

/**
 * Extension of the HybridConfigurationStore that allows optionally isolating the serving store from
 * updates.
 * This could be useful when you want to avoid updating the serving store to maintain greater
 * consistency within a session, but still want to update the cache for a quick, updated
 * initialization the next session.
 */
export class IsolatableHybridConfigurationStore<T> extends HybridConfigurationStore<T> {
  constructor(
    private readonly _servingStore: ISyncStore<T>,
    private readonly _persistentStore: IAsyncStore<T> | null,
    private servingStoreUpdateStrategy: ServingStoreUpdateStrategy = 'always',
  ) {
    super(_servingStore, _persistentStore);
  }

  /** @Override */
  public async setEntries(entries: Record<string, T>): Promise<void> {
    if (this._persistentStore) {
      // always update persistent store
      await this._persistentStore.setEntries(entries);
    }

    const persistentStoreIsExpired =
      !this._persistentStore || (await this._persistentStore.isExpired());
    const servingStoreIsEmpty = !this._servingStore.getKeys()?.length;

    // Update the serving store based on the update strategy:
    // "always" - always update the serving store
    // "expired" - only update if the persistent store is expired
    // "empty" - only update if the persistent store is expired and the serving store is empty
    const updateServingStore =
      this.servingStoreUpdateStrategy === 'always' ||
      (persistentStoreIsExpired && this.servingStoreUpdateStrategy === 'expired') ||
      (persistentStoreIsExpired && servingStoreIsEmpty);

    if (updateServingStore) {
      this._servingStore.setEntries(entries);
    }
  }
}
