import * as LZString from 'lz-string';

import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import { IStringStorageEngine } from './string-valued.store';

interface EppoGlobalMeta {
  migratedAt?: number;
  version: number;
}

/**
 * Local storage implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This serializes the entire contents into a single string and then stores it to a single local
 * storage key. Same with metadata about the store (e.g., when it was last updated).
 *
 * Starting from migration version 1, all data is stored compressed using LZ-string.
 */
export class LocalStorageEngine implements IStringStorageEngine {
  private static readonly GLOBAL_META_KEY = 'eppo-meta';
  private static readonly MIGRATION_VERSION = 1;

  private readonly contentsKey;
  private readonly metaKey;

  public constructor(
    private localStorage: Storage,
    storageKeySuffix: string,
  ) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.contentsKey = CONFIGURATION_KEY + keySuffix;
    this.metaKey = META_KEY + keySuffix;

    // Run migration once globally
    this.ensureCompressionMigration();
  }

  public getContentsJsonString = async (): Promise<string | null> => {
    const stored = this.localStorage.getItem(this.contentsKey);
    if (!stored) return null;

    try {
      return LZString.decompress(stored) || null;
    } catch (e) {
      console.warn('Failed to decompress configuration, removing corrupted data');
      this.localStorage.removeItem(this.contentsKey);
      return null;
    }
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    const stored = this.localStorage.getItem(this.metaKey);
    if (!stored) return null;

    try {
      return LZString.decompress(stored) || null;
    } catch (e) {
      console.warn('Failed to decompress meta, removing corrupted data');
      this.localStorage.removeItem(this.metaKey);
      return null;
    }
  };

  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    const compressed = LZString.compress(configurationJsonString);
    this.localStorage.setItem(this.contentsKey, compressed);
  };

  public setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    const compressed = LZString.compress(metaJsonString);
    this.localStorage.setItem(this.metaKey, compressed);
  };

  private ensureCompressionMigration(): void {
    const globalMeta = this.getGlobalMeta();

    if (globalMeta.version >= LocalStorageEngine.MIGRATION_VERSION) {
      return; // Already migrated
    }

    console.log(
      `Running storage migration from v${globalMeta.version} to v${LocalStorageEngine.MIGRATION_VERSION}`,
    );

    try {
      this.deleteAllConfigurations();

      this.setGlobalMeta({
        migratedAt: Date.now(),
        version: LocalStorageEngine.MIGRATION_VERSION,
      });

      console.log('Configuration cleanup completed - fresh configs will be compressed');
    } catch (e) {
      console.warn('Migration failed:', e);
    }
  }

  private deleteAllConfigurations(): void {
    const keysToDelete: string[] = [];

    // Find all eppo-configuration keys (both data and meta)
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      if (key?.startsWith('eppo-configuration')) {
        keysToDelete.push(key);
      }
    }

    // Delete all at once
    keysToDelete.forEach((key) => {
      this.localStorage.removeItem(key);
    });

    console.log(`Deleted ${keysToDelete.length} old configuration keys.`);
  }

  private getGlobalMeta(): EppoGlobalMeta {
    try {
      const stored = this.localStorage.getItem(LocalStorageEngine.GLOBAL_META_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse global meta:', e);
    }

    return { version: 0 }; // Default to version 0
  }

  private setGlobalMeta(meta: EppoGlobalMeta): void {
    this.localStorage.setItem(LocalStorageEngine.GLOBAL_META_KEY, JSON.stringify(meta));
  }
}
