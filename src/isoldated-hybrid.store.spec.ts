import {
  IsolatedHybridConfigurationStore,
  ServingStoreUpdateStrategy,
} from './isolated-hybrid.store';

describe('IsolatedHybridConfigurationStore', () => {
  const syncStoreMock = {
    get: jest.fn(),
    getKeys: jest.fn(),
    isInitialized: jest.fn(),
    setEntries: jest.fn(),
  };

  const asyncStoreMock = {
    getEntries: jest.fn(),
    isInitialized: jest.fn(),
    isExpired: jest.fn(),
    setEntries: jest.fn(),
  };

  const servingStoreUpdateStrategies: ServingStoreUpdateStrategy[] = ['always', 'expired', 'never'];

  // Dynamically create a describe() block for stores initialized with each of the three update strategies
  servingStoreUpdateStrategies.forEach((updateStrategy) => {
    const store = new IsolatedHybridConfigurationStore(
      syncStoreMock,
      asyncStoreMock,
      updateStrategy,
    );

    describe(updateStrategy + ' serving store update strategy', () => {
      beforeEach(() => {
        jest.resetAllMocks();
      });

      it('should initialize the serving store with entries from the persistent store', async () => {
        const entries = { key1: 'value1', key2: 'value2' };
        (asyncStoreMock.isInitialized as jest.Mock).mockReturnValue(true);
        (asyncStoreMock.getEntries as jest.Mock).mockResolvedValue(entries);

        await store.init();

        expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
      });

      it('should set serving store entries based on the update strategy', async () => {
        const entries = { key1: 'value1', key2: 'value2' };
        (asyncStoreMock.isInitialized as jest.Mock).mockReturnValue(true);

        (asyncStoreMock.isExpired as jest.Mock).mockReturnValue(false);
        await store.setEntries(entries);

        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        if (updateStrategy === 'always') {
          expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        } else {
          expect(syncStoreMock.setEntries).not.toHaveBeenCalled();
        }

        (asyncStoreMock.isExpired as jest.Mock).mockReturnValue(true);
        await store.setEntries(entries);
        expect(asyncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        if (updateStrategy !== 'never') {
          expect(syncStoreMock.setEntries).toHaveBeenCalledWith(entries);
        } else {
          expect(syncStoreMock.setEntries).not.toHaveBeenCalled();
        }
      });
    });
  });
});
