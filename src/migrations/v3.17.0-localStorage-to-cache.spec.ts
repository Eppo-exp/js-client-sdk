import { LocalStorageToCacheMigration } from './v3.17.0-localStorage-to-cache';

// Mock the configuration factory functions
jest.mock('../configuration-factory', () => ({
  hasWindowLocalStorage: jest.fn(() => true),
  localStorageIfAvailable: jest.fn(),
}));

describe('LocalStorageToCacheMigration', () => {
  let mockLocalStorage: Storage;
  let migration: LocalStorageToCacheMigration;
  const migrationFlagKey = 'eppo-migration-v3.17.0-localStorage-to-cache-completed';

  beforeEach(() => {
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      get length() {
        return this._length || 0;
      },
      set length(value) {
        this._length = value;
      },
      _length: 0,
    } as any;

    migration = new LocalStorageToCacheMigration(mockLocalStorage);

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided localStorage', () => {
      expect(migration).toBeInstanceOf(LocalStorageToCacheMigration);
      expect(migration.version).toBe('v3.17.0-localStorage-to-cache');
    });

    it('should handle missing window.localStorage gracefully', () => {
      const { hasWindowLocalStorage, localStorageIfAvailable } = jest.requireMock(
        '../configuration-factory',
      );
      hasWindowLocalStorage.mockReturnValue(false);
      localStorageIfAvailable.mockReturnValue(undefined);

      const defaultMigration = new LocalStorageToCacheMigration();
      expect(defaultMigration).toBeInstanceOf(LocalStorageToCacheMigration);

      // Should assume migration is completed when no localStorage
      expect(defaultMigration.isMigrationCompleted()).toBe(true);

      // Restore mocks
      hasWindowLocalStorage.mockReturnValue(true);
      localStorageIfAvailable.mockReturnValue(mockLocalStorage);
    });
  });

  describe('isMigrationCompleted', () => {
    it('should return true when migration flag is set', () => {
      (mockLocalStorage.getItem as jest.Mock).mockReturnValue('true');

      expect(migration.isMigrationCompleted()).toBe(true);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(migrationFlagKey);
    });

    it('should return false when migration flag is not set', () => {
      (mockLocalStorage.getItem as jest.Mock).mockReturnValue(null);

      expect(migration.isMigrationCompleted()).toBe(false);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(migrationFlagKey);
    });

    it('should return false when migration flag has wrong value', () => {
      (mockLocalStorage.getItem as jest.Mock).mockReturnValue('false');

      expect(migration.isMigrationCompleted()).toBe(false);
    });

    it('should handle localStorage errors gracefully', () => {
      (mockLocalStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(migration.isMigrationCompleted()).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to check migration status for v3.17.0-localStorage-to-cache:',
        expect.any(Error),
      );
    });
  });

  describe('markMigrationCompleted', () => {
    it('should set migration flag to true', () => {
      migration.markMigrationCompleted();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(migrationFlagKey, 'true');
    });

    it('should handle localStorage errors gracefully', () => {
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      migration.markMigrationCompleted();

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to mark migration as completed for v3.17.0-localStorage-to-cache:',
        expect.any(Error),
      );
    });
  });

  describe('getConfigurationKeys', () => {
    it('should return keys that start with eppo-configuration', () => {
      (mockLocalStorage as any)._length = 5;
      (mockLocalStorage.key as jest.Mock)
        .mockReturnValueOnce('eppo-configuration-key1')
        .mockReturnValueOnce('other-key')
        .mockReturnValueOnce('eppo-configuration-key2')
        .mockReturnValueOnce('eppo-configuration-meta')
        .mockReturnValueOnce('random-key');

      const keys = migration.getConfigurationKeys();

      expect(keys).toEqual([
        'eppo-configuration-key1',
        'eppo-configuration-key2',
        'eppo-configuration-meta',
      ]);
      expect(mockLocalStorage.key).toHaveBeenCalledTimes(5);
    });

    it('should return empty array when no configuration keys exist', () => {
      (mockLocalStorage as any)._length = 2;
      (mockLocalStorage.key as jest.Mock)
        .mockReturnValueOnce('other-key')
        .mockReturnValueOnce('random-key');

      const keys = migration.getConfigurationKeys();

      expect(keys).toEqual([]);
    });

    it('should handle null keys from localStorage', () => {
      (mockLocalStorage as any)._length = 3;
      (mockLocalStorage.key as jest.Mock)
        .mockReturnValueOnce('eppo-configuration-key1')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('eppo-configuration-key2');

      const keys = migration.getConfigurationKeys();

      expect(keys).toEqual(['eppo-configuration-key1', 'eppo-configuration-key2']);
    });

    it('should handle localStorage errors gracefully', () => {
      (mockLocalStorage as any)._length = 1;
      (mockLocalStorage.key as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const keys = migration.getConfigurationKeys();

      expect(keys).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to enumerate localStorage keys for v3.17.0-localStorage-to-cache:',
        expect.any(Error),
      );
    });
  });

  describe('clearConfigurationKeys', () => {
    beforeEach(() => {
      // Mock isMigrationCompleted to return false initially
      jest.spyOn(migration, 'isMigrationCompleted').mockReturnValue(false);
      jest.spyOn(migration, 'markMigrationCompleted').mockImplementation();
    });

    it('should return early if migration already completed', () => {
      jest.spyOn(migration, 'isMigrationCompleted').mockReturnValue(true);

      const result = migration.clearConfigurationKeys();

      expect(result).toEqual({
        migrationNeeded: false,
        clearedKeys: [],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });
      expect(migration.markMigrationCompleted).not.toHaveBeenCalled();
    });

    it('should clear configuration keys successfully', () => {
      jest
        .spyOn(migration, 'getConfigurationKeys')
        .mockReturnValue(['eppo-configuration-key1', 'eppo-configuration-key2']);

      const result = migration.clearConfigurationKeys();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-key2');
      expect(migration.markMigrationCompleted).toHaveBeenCalled();
      expect(result).toEqual({
        migrationNeeded: true,
        clearedKeys: ['eppo-configuration-key1', 'eppo-configuration-key2'],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });
    });

    it('should handle removal errors but continue with other keys', () => {
      jest
        .spyOn(migration, 'getConfigurationKeys')
        .mockReturnValue([
          'eppo-configuration-key1',
          'eppo-configuration-key2',
          'eppo-configuration-key3',
        ]);

      (mockLocalStorage.removeItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-configuration-key2') {
          throw new Error('Remove failed');
        }
      });

      const result = migration.clearConfigurationKeys();

      expect(result.migrationNeeded).toBe(true);
      expect(result.clearedKeys).toEqual(['eppo-configuration-key1', 'eppo-configuration-key3']);
      expect(result.errors).toEqual([
        'Failed to remove key eppo-configuration-key2: Error: Remove failed',
      ]);
      expect(migration.markMigrationCompleted).toHaveBeenCalled();
    });

    it('should return no migration needed when no configuration keys exist', () => {
      jest.spyOn(migration, 'getConfigurationKeys').mockReturnValue([]);

      const result = migration.clearConfigurationKeys();

      expect(result).toEqual({
        migrationNeeded: false,
        clearedKeys: [],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });
      expect(migration.markMigrationCompleted).not.toHaveBeenCalled();
    });
  });

  describe('migrate', () => {
    it('should run migration successfully', async () => {
      jest.spyOn(migration, 'clearConfigurationKeys').mockReturnValue({
        migrationNeeded: true,
        clearedKeys: ['eppo-configuration-key1'],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });

      const result = await migration.migrate();

      expect(console.log).toHaveBeenCalledWith(
        'Starting migration v3.17.0-localStorage-to-cache...',
      );
      expect(console.log).toHaveBeenCalledWith(
        'Migration v3.17.0-localStorage-to-cache completed: cleared 1 keys',
        expect.objectContaining({
          clearedKeys: ['eppo-configuration-key1'],
          errors: [],
        }),
      );
      expect(result.migrationNeeded).toBe(true);
    });

    it('should handle case when no migration is needed', async () => {
      jest.spyOn(migration, 'clearConfigurationKeys').mockReturnValue({
        migrationNeeded: false,
        clearedKeys: [],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });

      const result = await migration.migrate();

      expect(console.log).toHaveBeenCalledWith(
        'Migration v3.17.0-localStorage-to-cache: No migration needed - already completed or no keys found',
      );
      expect(result.migrationNeeded).toBe(false);
    });
  });

  describe('forceMigrate', () => {
    it('should clear migration flag and run migration', async () => {
      jest.spyOn(migration, 'migrate').mockResolvedValue({
        migrationNeeded: true,
        clearedKeys: ['test-key'],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });

      const result = await migration.forceMigrate();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(migrationFlagKey);
      expect(migration.migrate).toHaveBeenCalled();
      expect(result.migrationNeeded).toBe(true);
    });

    it('should handle errors when clearing migration flag', async () => {
      (mockLocalStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('Remove failed');
      });

      jest.spyOn(migration, 'migrate').mockResolvedValue({
        migrationNeeded: false,
        clearedKeys: [],
        errors: [],
        version: 'v3.17.0-localStorage-to-cache',
      });

      await migration.forceMigrate();

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to clear migration flag for v3.17.0-localStorage-to-cache:',
        expect.any(Error),
      );
      expect(migration.migrate).toHaveBeenCalled();
    });
  });
});
