/**
 * Migration Manager for handling versioned storage migrations
 */

import { localStorageIfAvailable } from '../configuration-factory';

import { LocalStorageToCacheMigration } from './v3.17.0-localStorage-to-cache';

export interface Migration {
  version: string;
  isMigrationCompleted(): boolean;

  migrate(): Promise<{
    migrationNeeded: boolean;
    clearedKeys: string[];
    errors: string[];
    version: string;
  }>;
}

/**
 * Manages all storage migrations in order
 */
export class MigrationManager {
  private readonly migrations: Migration[];

  constructor(localStorage?: Storage) {
    const storageToUse = localStorage || localStorageIfAvailable();

    // Register all migrations in order
    this.migrations = [
      new LocalStorageToCacheMigration(storageToUse),
      // Future migrations will be added here
    ];
  }

  /**
   * Run all pending migrations
   */
  public async runPendingMigrations(): Promise<void> {
    console.log('Checking for pending storage migrations...');

    for (const migration of this.migrations) {
      if (!migration.isMigrationCompleted()) {
        console.log(`Running pending migration: ${migration.version}`);
        try {
          await migration.migrate();
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          // Continue with other migrations even if one fails
        }
      }
    }
  }

  /**
   * Check if a specific migration has been completed
   */
  public isMigrationCompleted(version: string): boolean {
    const migration = this.migrations.find((m) => m.version === version);
    return migration ? migration.isMigrationCompleted() : false;
  }

  /**
   * Get all registered migration versions
   */
  public getAllMigrationVersions(): string[] {
    return this.migrations.map((m) => m.version);
  }

  /**
   * Get pending migration versions
   */
  public getPendingMigrationVersions(): string[] {
    return this.migrations.filter((m) => !m.isMigrationCompleted()).map((m) => m.version);
  }
}
