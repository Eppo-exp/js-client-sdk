import { localStorageIfAvailable } from '../configuration-factory';

/**
 * Migration v3.17.0: localStorage to Web Cache API
 *
 * This migration clears localStorage keys with 'eppo-configuration' prefix
 * when upgrading to Web Cache API storage.
 */

const MIGRATION_VERSION = 'v3.17.0-localStorage-to-cache';
const MIGRATION_FLAG_KEY = `eppo-migration-${MIGRATION_VERSION}-completed`;
const CONFIGURATION_PREFIX = 'eppo-configuration';

export interface MigrationResult {
  migrationNeeded: boolean;
  clearedKeys: string[];
  errors: string[];
  version: string;
}

/**
 * Migration v3.17.0: Move from localStorage to Web Cache API
 */
export class LocalStorageToCacheMigration {
  private readonly localStorage?: Storage;
  public readonly version = MIGRATION_VERSION;

  constructor(localStorage?: Storage) {
    this.localStorage = localStorage || localStorageIfAvailable();
  }

  /**
   * Check if this specific migration has been completed
   */
  public isMigrationCompleted(): boolean {
    // If no localStorage available, assume migration is completed
    if (!this.localStorage) {
      return true;
    }

    try {
      return this.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
    } catch (error) {
      console.warn(`Failed to check migration status for ${this.version}:`, error);
      return true; // Assume completed on error
    }
  }

  /**
   * Mark this migration as completed
   */
  public markMigrationCompleted(): void {
    if (!this.localStorage) {
      return; // Can't persist without localStorage
    }

    try {
      this.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    } catch (error) {
      console.warn(`Failed to mark migration as completed for ${this.version}:`, error);
    }
  }

  /**
   * Get all localStorage keys that match the eppo-configuration prefix
   */
  public getConfigurationKeys(): string[] {
    const keys: string[] = [];

    if (!this.localStorage) {
      return keys;
    }

    try {
      for (let i = 0; i < this.localStorage.length; i++) {
        const key = this.localStorage.key(i);
        if (key && key.startsWith(CONFIGURATION_PREFIX)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.warn(`Failed to enumerate localStorage keys for ${this.version}:`, error);
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
      errors: [],
      version: this.version,
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
        this.localStorage?.removeItem(key);
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
    console.log(`Starting migration ${this.version}...`);

    const result = this.clearConfigurationKeys();

    if (result.migrationNeeded) {
      console.log(
        `Migration ${this.version} completed: cleared ${result.clearedKeys.length} keys`,
        {
          clearedKeys: result.clearedKeys,
          errors: result.errors,
        },
      );
    } else {
      console.log(
        `Migration ${this.version}: No migration needed - already completed or no keys found`,
      );
    }

    return result;
  }

  /**
   * Force re-run migration (clears migration flag first)
   */
  public async forceMigrate(): Promise<MigrationResult> {
    if (this.localStorage) {
      try {
        this.localStorage.removeItem(MIGRATION_FLAG_KEY);
      } catch (error) {
        console.warn(`Failed to clear migration flag for ${this.version}:`, error);
      }
    }

    return this.migrate();
  }
}
