import { type Migration, MigrationManager } from './migration-manager';

// Mock migration for testing
class MockMigrationV1 implements Migration {
  public readonly version = 'v1.0.0-test-migration';
  private completed = false;
  private shouldFail = false;
  public migrateCalled = false;

  constructor(completed = false, shouldFail = false) {
    this.completed = completed;
    this.shouldFail = shouldFail;
  }

  public isMigrationCompleted(): boolean {
    return this.completed;
  }

  public async migrate(): Promise<{
    migrationNeeded: boolean;
    clearedKeys: string[];
    errors: string[];
    version: string;
  }> {
    this.migrateCalled = true;

    if (this.shouldFail) {
      throw new Error('Mock migration failed');
    }

    this.completed = true;
    return {
      migrationNeeded: true,
      clearedKeys: ['test-key-1', 'test-key-2'],
      errors: [],
      version: this.version,
    };
  }
}

class MockMigrationV2 implements Migration {
  public readonly version = 'v2.0.0-another-migration';
  private completed = false;
  public migrateCalled = false;

  constructor(completed = false) {
    this.completed = completed;
  }

  public isMigrationCompleted(): boolean {
    return this.completed;
  }

  public async migrate(): Promise<{
    migrationNeeded: boolean;
    clearedKeys: string[];
    errors: string[];
    version: string;
  }> {
    this.migrateCalled = true;
    this.completed = true;
    return {
      migrationNeeded: true,
      clearedKeys: ['test-key-3'],
      errors: [],
      version: this.version,
    };
  }
}

describe('MigrationManager', () => {
  let mockLocalStorage: Storage;
  let migrationManager: MigrationManager;
  let mockMigrationV1: MockMigrationV1;
  let mockMigrationV2: MockMigrationV2;

  beforeEach(() => {
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    // Create a test migration manager with mock migrations
    mockMigrationV1 = new MockMigrationV1();
    mockMigrationV2 = new MockMigrationV2();

    migrationManager = new MigrationManager(mockLocalStorage);
    // Override migrations with our mocks for testing
    (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with localStorage', () => {
      const manager = new MigrationManager(mockLocalStorage);
      expect(manager).toBeInstanceOf(MigrationManager);
    });

    it('should handle missing window.localStorage gracefully', () => {
      const manager = new MigrationManager();
      expect(manager).toBeInstanceOf(MigrationManager);
    });
  });

  describe('getAllMigrationVersions', () => {
    it('should return all registered migration versions', () => {
      const versions = migrationManager.getAllMigrationVersions();
      expect(versions).toEqual(['v1.0.0-test-migration', 'v2.0.0-another-migration']);
    });
  });

  describe('getPendingMigrationVersions', () => {
    it('should return pending migration versions', () => {
      // Both migrations are pending initially
      const pending = migrationManager.getPendingMigrationVersions();
      expect(pending).toEqual(['v1.0.0-test-migration', 'v2.0.0-another-migration']);
    });

    it('should return only uncompleted migrations', () => {
      // Mark first migration as completed
      mockMigrationV1 = new MockMigrationV1(true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      const pending = migrationManager.getPendingMigrationVersions();
      expect(pending).toEqual(['v2.0.0-another-migration']);
    });

    it('should return empty array when all migrations are completed', () => {
      // Mark both migrations as completed
      mockMigrationV1 = new MockMigrationV1(true);
      mockMigrationV2 = new MockMigrationV2(true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      const pending = migrationManager.getPendingMigrationVersions();
      expect(pending).toEqual([]);
    });
  });

  describe('isMigrationCompleted', () => {
    it('should return true for completed migration', () => {
      mockMigrationV1 = new MockMigrationV1(true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      expect(migrationManager.isMigrationCompleted('v1.0.0-test-migration')).toBe(true);
    });

    it('should return false for uncompleted migration', () => {
      expect(migrationManager.isMigrationCompleted('v1.0.0-test-migration')).toBe(false);
    });

    it('should return false for non-existent migration', () => {
      expect(migrationManager.isMigrationCompleted('v999.0.0-does-not-exist')).toBe(false);
    });
  });

  describe('runPendingMigrations', () => {
    it('should run all pending migrations', async () => {
      await migrationManager.runPendingMigrations();

      expect(mockMigrationV1.migrateCalled).toBe(true);
      expect(mockMigrationV2.migrateCalled).toBe(true);
      expect(console.log).toHaveBeenCalledWith('Checking for pending storage migrations...');
      expect(console.log).toHaveBeenCalledWith('Running pending migration: v1.0.0-test-migration');
      expect(console.log).toHaveBeenCalledWith(
        'Running pending migration: v2.0.0-another-migration',
      );
    });

    it('should skip completed migrations', async () => {
      // Mark first migration as completed
      mockMigrationV1 = new MockMigrationV1(true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      await migrationManager.runPendingMigrations();

      expect(mockMigrationV1.migrateCalled).toBe(false);
      expect(mockMigrationV2.migrateCalled).toBe(true);
      expect(console.log).not.toHaveBeenCalledWith(
        'Running pending migration: v1.0.0-test-migration',
      );
      expect(console.log).toHaveBeenCalledWith(
        'Running pending migration: v2.0.0-another-migration',
      );
    });

    it('should continue other migrations if one fails', async () => {
      // Make first migration fail
      mockMigrationV1 = new MockMigrationV1(false, true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      await migrationManager.runPendingMigrations();

      expect(mockMigrationV1.migrateCalled).toBe(true);
      expect(mockMigrationV2.migrateCalled).toBe(true);
      expect(console.error).toHaveBeenCalledWith(
        'Migration v1.0.0-test-migration failed:',
        expect.any(Error),
      );
    });

    it('should handle empty migrations array', async () => {
      (migrationManager as any).migrations = [];

      await migrationManager.runPendingMigrations();

      expect(console.log).toHaveBeenCalledWith('Checking for pending storage migrations...');
      // Should not throw or cause issues
    });

    it('should not run migrations if all are completed', async () => {
      // Mark both migrations as completed
      mockMigrationV1 = new MockMigrationV1(true);
      mockMigrationV2 = new MockMigrationV2(true);
      (migrationManager as any).migrations = [mockMigrationV1, mockMigrationV2];

      await migrationManager.runPendingMigrations();

      expect(mockMigrationV1.migrateCalled).toBe(false);
      expect(mockMigrationV2.migrateCalled).toBe(false);
      expect(console.log).toHaveBeenCalledWith('Checking for pending storage migrations...');
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Running pending migration:'),
      );
    });
  });
});
