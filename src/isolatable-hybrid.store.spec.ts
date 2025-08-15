import {
  IsolatableHybridConfigurationStore,
  ServingStoreUpdateStrategy,
} from './isolatable-hybrid.store';
import { StorageFullUnableToWrite } from './string-valued.store';

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

  describe('StorageFullUnableToWrite exception handling', () => {
    const store = new IsolatableHybridConfigurationStore(
      syncStoreMock,
      asyncStoreMock,
      'always'
    );

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should continue operating even when async store fails with StorageFullUnableToWrite', async () => {
      const entries = { key1: 'value1' };
      asyncStoreMock.isInitialized.mockReturnValue(true);
      asyncStoreMock.isExpired.mockReturnValue(true);
      asyncStoreMock.setEntries.mockRejectedValue(new StorageFullUnableToWrite());
      syncStoreMock.setEntries.mockResolvedValue(undefined);
      syncStoreMock.getKeys.mockReturnValue([]);

      // Should not throw - be resilient to async store failures
      await expect(store.setEntries(entries)).resolves.not.toThrow();
      
      // Sync store should still be updated for resilience
      expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
    });

    it('should handle StorageFullUnableToWrite during initialization', async () => {
      asyncStoreMock.isInitialized.mockReturnValue(false);
      asyncStoreMock.entries.mockRejectedValue(new StorageFullUnableToWrite());

      await expect(store.init()).rejects.toThrow(StorageFullUnableToWrite);
    });

    it('should handle async store failures gracefully', async () => {
      const entries = { key1: 'value1' };
      asyncStoreMock.isInitialized.mockReturnValue(true);
      asyncStoreMock.isExpired.mockReturnValue(true);
      asyncStoreMock.setEntries.mockRejectedValue(new StorageFullUnableToWrite());
      syncStoreMock.setEntries.mockResolvedValue(undefined);
      syncStoreMock.getKeys.mockReturnValue([]);

      // Should not throw even if async store fails
      await expect(store.setEntries(entries)).resolves.not.toThrow();
      
      expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
      expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
    });
  });
});
