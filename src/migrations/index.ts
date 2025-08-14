/**
 * Storage Migrations
 *
 * This module handles versioned storage migrations for the Eppo SDK.
 * Each migration is versioned and tracked to ensure it only runs once.
 */

export { LocalStorageToCacheMigration } from './v3.17.0-localStorage-to-cache';
export { MigrationManager, type Migration } from './migration-manager';

// Convenience function for the current migration
export { MigrationManager as StorageMigration } from './migration-manager';
