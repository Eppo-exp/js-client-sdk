import * as LZString from 'lz-string';

import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import {
  IStringStorageEngine,
  StorageFullUnableToWrite,
  LocalStorageUnknownFailure,
} from './string-valued.store';

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
      const decompressed = LZString.decompressFromBase64(stored);
      if (decompressed) {
        console.log(
          `[Eppo LocalStorage] Successfully decompressed configuration: ${stored.length} → ${decompressed.length} bytes`,
        );
      }
      return decompressed || null;
    } catch (e) {
      console.warn(
        '[Eppo LocalStorage] Failed to decompress configuration, removing corrupted data:',
        e,
      );
      // Failed to decompress configuration, removing corrupted data
      this.localStorage.removeItem(this.contentsKey);
      return null;
    }
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.metaKey);
  };

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    const originalSize = configurationJsonString.length;
    const compressed = LZString.compressToBase64(configurationJsonString);
    const compressedSize = compressed.length;
    const compressionRatio = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

    console.log(
      `[Eppo LocalStorage] Compressing configuration data: ${originalSize} → ${compressedSize} bytes (${compressionRatio}% reduction)`,
    );

    this.safeWrite(this.contentsKey, compressed);
  };

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  public setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    this.safeWrite(this.metaKey, metaJsonString);
  };

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  private safeWrite(key: string, value: string): void {
    try {
      this.localStorage.setItem(key, value);
    } catch (error) {
      if (error instanceof DOMException) {
        // Check for quota exceeded error
        if (error.code === DOMException.QUOTA_EXCEEDED_ERR || error.name === 'QuotaExceededError') {
          console.log('[Eppo LocalStorage] Quota exceeded, clearing old data and retrying...');
          try {
            this.clear();
            console.log(
              '[Eppo LocalStorage] Successfully cleared old data, retrying write operation',
            );
            // Retry setting the item after clearing
            this.localStorage.setItem(key, value);
            console.log('[Eppo LocalStorage] Write operation succeeded after clearing old data');
            return;
          } catch {
            console.error(
              '[Eppo LocalStorage] Write operation failed even after clearing old data',
            );
            throw new StorageFullUnableToWrite();
          }
        }
      }
      // For any other error, wrap it in our custom exception
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Eppo LocalStorage] Non-quota error during write operation:', errorMessage);
      throw new LocalStorageUnknownFailure(
        `Failed to write to localStorage: ${errorMessage}`,
        error instanceof Error ? error : (error as Error),
      );
    }
  }

  private ensureCompressionMigration(): void {
    const globalMeta = this.getGlobalMeta();

    if (globalMeta.version >= LocalStorageEngine.MIGRATION_VERSION) {
      console.log(
        '[Eppo LocalStorage] Compression migration already completed (version:',
        globalMeta.version,
        ')',
      );
      return; // Already migrated
    }

    console.log(
      '[Eppo LocalStorage] Starting compression migration from version',
      globalMeta.version,
      'to',
      LocalStorageEngine.MIGRATION_VERSION,
    );

    try {
      this.clear();
      console.log('[Eppo LocalStorage] Cleared old uncompressed data for migration');

      this.setGlobalMeta({
        migratedAt: Date.now(),
        version: LocalStorageEngine.MIGRATION_VERSION,
      });
      console.log('[Eppo LocalStorage] Compression migration completed successfully');
    } catch (e) {
      console.warn('[Eppo LocalStorage] Compression migration failed, continuing silently:', e);
      // Migration failed, continue silently
    }
  }

  private getGlobalMeta(): EppoGlobalMeta {
    try {
      const stored = this.localStorage.getItem(LocalStorageEngine.GLOBAL_META_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Failed to parse global meta, will use default
    }

    return { version: 0 }; // Default to version 0
  }

  private setGlobalMeta(meta: EppoGlobalMeta): void {
    this.localStorage.setItem(LocalStorageEngine.GLOBAL_META_KEY, JSON.stringify(meta));
  }

  public clear(): void {
    const keysToDelete: string[] = [];

    // Collect all keys that start with 'eppo-configuration'
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      if (key?.startsWith(CONFIGURATION_KEY)) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      console.log(
        `[Eppo LocalStorage] Clearing ${keysToDelete.length} old configuration keys:`,
        keysToDelete,
      );
    }

    // Delete collected keys
    keysToDelete.forEach((key) => {
      this.localStorage.removeItem(key);
    });
  }
}
