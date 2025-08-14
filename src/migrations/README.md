# Storage Migrations

This directory contains versioned storage migrations for the Eppo SDK.

## Migration Versioning

Each migration is versioned using the SDK version when it was introduced, following this pattern:
- `v{major}.{minor}.{patch}-{description}`
- Example: `v3.17.0-localStorage-to-cache`

## Current Migrations

### v3.17.0-localStorage-to-cache
- **Purpose**: Migrate from localStorage to Web Cache API for better storage limits
- **What it does**: Clears all `eppo-configuration*` keys from localStorage when upgrading to Cache API storage
- **Completion tracking**: Uses `eppo-migration-v3.17.0-localStorage-to-cache-completed` localStorage flag

## Adding New Migrations

1. Create a new file: `v{version}-{description}.ts`
2. Implement the `Migration` interface
3. Add the migration to `MigrationManager.constructor()` 
4. Export from `index.ts`

Example:
```typescript
// v3.18.0-example-migration.ts
export class ExampleMigration implements Migration {
  public readonly version = 'v3.18.0-example-migration';
  
  public isMigrationCompleted(): boolean {
    // Check if migration was already run
  }
  
  public async migrate(): Promise<MigrationResult> {
    // Perform migration logic
  }
}
```

## Migration Manager

The `MigrationManager` handles:
- Running all pending migrations in order
- Tracking completion status
- Error handling (continues other migrations if one fails)
- Logging migration progress

## Usage

```typescript
import { MigrationManager } from './migrations';

const migrationManager = new MigrationManager(localStorage);
await migrationManager.runPendingMigrations();
```

## Best Practices

1. **Idempotent**: Migrations should be safe to run multiple times
2. **Backward Compatible**: Don't break existing functionality during migration
3. **Error Tolerant**: Handle errors gracefully and continue other migrations
4. **Logged**: Provide clear logging for debugging
5. **Versioned**: Always version migrations with the SDK release they're introduced in