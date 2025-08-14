/**
 * Migration utilities for moving from localStorage to Web Cache API
 */

const MIGRATION_FLAG_KEY = 'eppo-cache-migration-20250813-completed';
const CONFIGURATION_PREFIX = 'eppo-configuration';

export interface MigrationResult {
  migrationNeeded: boolean;
  clearedKeys: string[];
  errors: string[];
}

/**
 * Migrates configuration storage from localStorage to Web Cache API.
 * Clears all localStorage keys matching the eppo-configuration prefix.
 * Uses localStorage to track migration completion to avoid repeated migrations.
 */
export class StorageMigration {
  private readonly localStorage: Storage;

  constructor(localStorage: Storage = window.localStorage) {
    this.localStorage = localStorage;
  }

  /**
   * Check if migration has already been completed
   */
  public isMigrationCompleted(): boolean {
    try {
      return this.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
    } catch (error) {
      console.warn('Failed to check migration status:', error);
      return false;
    }
  }

  /**
   * Mark migration as completed
   */
  public markMigrationCompleted(): void {
    try {
      this.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    } catch (error) {
      console.warn('Failed to mark migration as completed:', error);
    }
  }

  /**
   * Get all localStorage keys that match the eppo-configuration prefix
   */
  public getConfigurationKeys(): string[] {
    const keys: string[] = [];
    
    try {
      for (let i = 0; i < this.localStorage.length; i++) {
        const key = this.localStorage.key(i);
        if (key && key.startsWith(CONFIGURATION_PREFIX)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.warn('Failed to enumerate localStorage keys:', error);
    }

    return keys;
  }

  /**
   * Clear all localStorage keys with eppo-configuration prefix
   */
  public clearConfigurationKeys(): MigrationResult {
    const result: MigrationResult = {
      migrationNeeded: false,
      clearedKeys: [],
      errors: []
    };

    // Check if migration already completed
    if (this.isMigrationCompleted()) {
      return result;
    }

    const keysToRemove = this.getConfigurationKeys();
    result.migrationNeeded = keysToRemove.length > 0;

    // Remove each configuration key
    for (const key of keysToRemove) {
      try {
        this.localStorage.removeItem(key);
        result.clearedKeys.push(key);
      } catch (error) {
        const errorMsg = `Failed to remove key ${key}: ${error}`;
        console.warn(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    // Mark migration as completed if we processed any keys (even with errors)
    if (result.migrationNeeded) {
      this.markMigrationCompleted();
    }

    return result;
  }

  /**
   * Run the complete migration process
   */
  public async migrate(): Promise<MigrationResult> {
    console.log('Starting localStorage to Web Cache API migration...');
    
    const result = this.clearConfigurationKeys();
    
    if (result.migrationNeeded) {
      console.log(`Migration completed: cleared ${result.clearedKeys.length} keys`, {
        clearedKeys: result.clearedKeys,
        errors: result.errors
      });
    } else {
      console.log('No migration needed - already completed or no keys found');
    }

    return result;
  }

  /**
   * Force re-run migration (clears migration flag first)
   */
  public async forceMigrate(): Promise<MigrationResult> {
    try {
      this.localStorage.removeItem(MIGRATION_FLAG_KEY);
    } catch (error) {
      console.warn('Failed to clear migration flag:', error);
    }
    
    return this.migrate();
  }
}

/**
 * Convenience function to run migration
 */
export async function migrateStorageToCache(): Promise<MigrationResult> {
  const migration = new StorageMigration();
  return migration.migrate();
}