import { ISyncStore, MemoryStore } from '@eppo/js-client-sdk-common';

import {
  IPairedAsyncStore,
  IsolatableHybridConfigurationStore,
  ServingStoreUpdateStrategy,
} from './isolatable-hybrid.store';

describe('IsolatableHybridConfigurationStore', () => {
  const syncStoreMock = {
    get: jest.fn(),
    getKeys: jest.fn(),
    isInitialized: jest.fn(),
    entries: jest.fn(),
    setEntries: jest.fn(),
  };

  const asyncStoreMock = {
    isInitialized: jest.fn(),
    isExpired: jest.fn(),
    entries: jest.fn(),
    setEntries: jest.fn(),
  };

  const servingStoreUpdateStrategies: ServingStoreUpdateStrategy[] = ['always', 'expired', 'empty'];

  describe.each(servingStoreUpdateStrategies)(
    '%s serving store update strategy',
    (updateStrategy: ServingStoreUpdateStrategy) => {
      const store = new IsolatableHybridConfigurationStore(
        syncStoreMock,
        asyncStoreMock,
        updateStrategy,
      );

      beforeEach(() => {
        jest.resetAllMocks();
      });

      it('should initialize the serving store with entries from the persistent store', async () => {
        const entries = { key1: 'value1', key2: 'value2' };
        asyncStoreMock.isInitialized.mockReturnValue(true);
        asyncStoreMock.entries.mockResolvedValue(entries);

        await store.init();

        expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        expect(asyncStoreMock.setEntries).not.toHaveBeenCalled();
      });

      it('should set serving store entries for an empty store based on the update strategy', async () => {
        asyncStoreMock.isInitialized.mockReturnValue(true);
        asyncStoreMock.isExpired.mockReturnValue(false);

        await store.init();
        // Expect sync store to be initialized with the empty async store
        expect(syncStoreMock.setEntries).toHaveBeenCalledWith(undefined);
        expect(asyncStoreMock.setEntries).not.toHaveBeenCalled();

        // Simulate a fetch calling setEntries() when the persistent store is not expired
        syncStoreMock.setEntries.mockClear();
        asyncStoreMock.setEntries.mockClear();
        const entries = { key1: 'value1', key2: 'value2' };
        await store.setEntries(entries);

        // Async store is always updated
        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        if (updateStrategy === 'always') {
          // Since persistent store is not expired; we only update the sync store with the "always" strategy
          expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        } else {
          // All other strategies won't update the sync store when the async store is not expired
          expect(syncStoreMock.setEntries).not.toHaveBeenCalled();
        }

        // Simulate a fetch calling setEntries() when the persistent store is now expired and
        // the serving store is still empty
        syncStoreMock.setEntries.mockClear();
        asyncStoreMock.setEntries.mockClear();
        asyncStoreMock.isExpired.mockReturnValue(true);
        await store.setEntries(entries);

        // Async store is always updated
        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        // Sync store is always updated when the async store is expired and the serving store is empty
        expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
      });

      it('should set serving store entries for a populated store based on the update strategy', async () => {
        asyncStoreMock.isInitialized.mockReturnValue(true);
        asyncStoreMock.isExpired.mockReturnValue(false);
        const initialEntries = { key1: 'init1', key2: 'init2' };
        asyncStoreMock.entries.mockResolvedValue(initialEntries);

        await store.init();
        // Expect sync store to be initialized with the empty async store
        expect(syncStoreMock.setEntries).toHaveBeenCalledWith(initialEntries);
        expect(asyncStoreMock.setEntries).not.toHaveBeenCalled();

        // Simulate a fetch calling setEntries() when the persistent store is not expired
        syncStoreMock.setEntries.mockClear();
        asyncStoreMock.setEntries.mockClear();
        const entries = { key1: 'value1', key2: 'value2' };
        await store.setEntries(entries);

        // Async store is always updated
        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        if (updateStrategy === 'always') {
          // Since persistent store is not expired; we only update the sync store with the "always" strategy
          expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        } else {
          // All other strategies won't update the sync store when the async store is not expired
          expect(syncStoreMock.setEntries).not.toHaveBeenCalled();
        }

        // Simulate a fetch calling setEntries() when the persistent store is now expired, but the
        // serving store has been populated from its old values
        syncStoreMock.setEntries.mockClear();
        syncStoreMock.getKeys.mockReturnValue(Object.keys(entries));
        asyncStoreMock.setEntries.mockClear();
        asyncStoreMock.isExpired.mockReturnValue(true);
        await store.setEntries(entries);

        // Async store is always updated
        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        if (updateStrategy !== 'empty') {
          // Since the async store is expired, we expect every strategy other than "empty" to update the sync store
          expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        } else {
          // Since the serving store is non-empty, there is no update to it with the "empty" strategy
          expect(syncStoreMock.setEntries).not.toHaveBeenCalled();
        }
      });
    },
  );

  describe('Serving store hooks', () => {
    let syncStore: ISyncStore<number>;
    let persistentStore: IPairedAsyncStore<number> & {
      // custom persistent store method to set serving store entries
      setServingEntries(entries?: Record<string, number>): Promise<void>;
    };
    let store: IsolatableHybridConfigurationStore<number>;

    const initialEntries = { a: 1, b: 2 };
    const newEntries = { a: 3, b: 4 };

    beforeEach(() => {
      let dummyStorage: Record<string, number> = initialEntries;
      let rehydrationCallback: (entries?: Record<string, number>) => Promise<void>;
      syncStore = new MemoryStore();
      persistentStore = {
        async entries(): Promise<Record<string, number>> {
          return dummyStorage;
        },
        async setEntries(entries: Record<string, number>): Promise<void> {
          dummyStorage = entries;
        },
        async isExpired(): Promise<boolean> {
          return false;
        },
        isInitialized(): boolean {
          return true;
        },
        // Optional register rehydrate hook provided
        registerRehydrate(rehydrate: (entries?: Record<string, number>) => Promise<void>): void {
          rehydrationCallback = rehydrate;
        },
        // Below method custom to this persistent store
        async setServingEntries(entries?: Record<string, number>): Promise<void> {
          rehydrationCallback && (await rehydrationCallback(entries));
        },
      };

      store = new IsolatableHybridConfigurationStore(syncStore, persistentStore, 'expired');
    });

    it('Provides hook to update serving store from persistent store', async () => {
      await store.init();
      // Expect sync store to be initialized with the async store
      expect((await persistentStore.entries())?.['a']).toBe(initialEntries['a']);
      expect(syncStore.get('a')).toBe(initialEntries['a']);

      // Update persistent store
      await persistentStore.setEntries(newEntries);

      // Should not have propagated to serving store because of update strategy "never"
      expect((await persistentStore.entries())?.['a']).toBe(newEntries['a']);
      expect(syncStore.get('a')).toBe(initialEntries['a']);

      // Use callback to manually rehydrate from persistent store
      await persistentStore.setServingEntries();
      expect(syncStore.get('a')).toBe(newEntries['a']);
    });

    it('Provides hook to explicitly update serving store', async () => {
      await store.init();
      // Expect sync store to be initialized with the async store
      expect((await persistentStore.entries())?.['a']).toBe(initialEntries['a']);
      expect(syncStore.get('a')).toBe(initialEntries['a']);

      // Use callback to explicitly hydrate serving store with new entries
      await persistentStore.setServingEntries(newEntries);
      expect(syncStore.get('a')).toBe(newEntries['a']);

      // Persistent store was not used for this update, left alone
      expect((await persistentStore.entries())?.['a']).toBe(initialEntries['a']);
    });
  });
});
