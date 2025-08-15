import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import {
  IStringStorageEngine,
  StorageFullUnableToWrite,
  LocalStorageUnknownFailure,
} from './string-valued.store';

/**
 * Local storage implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This serializes the entire contents into a single string and then stores it to a single local
 * storage key. Same with metadata about the store (e.g., when it was last updated).
 */
export class LocalStorageEngine implements IStringStorageEngine {
  private readonly contentsKey;
  private readonly metaKey;

  public constructor(
    private localStorage: Storage,
    storageKeySuffix: string,
  ) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.contentsKey = CONFIGURATION_KEY + keySuffix;
    this.metaKey = META_KEY + keySuffix;
  }

  public getContentsJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.contentsKey);
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.metaKey);
  };

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    this.safeWrite(this.contentsKey, configurationJsonString);
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
          try {
            this.clear();
            // Retry setting the item after clearing
            this.localStorage.setItem(key, value);
            return;
          } catch {
            throw new StorageFullUnableToWrite();
          }
        }
      }
      // For any other error, wrap it in our custom exception
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new LocalStorageUnknownFailure(
        `Failed to write to localStorage: ${errorMessage}`,
        error instanceof Error ? error : (error as Error),
      );
    }
  }

  public clear(): void {
    const keysToDelete: string[] = [];

    // Collect all keys that start with 'eppo-configuration'
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      if (key && key.startsWith(CONFIGURATION_KEY)) {
        keysToDelete.push(key);
      }
    }

    // Delete collected keys
    keysToDelete.forEach((key) => {
      this.localStorage.removeItem(key);
    });
  }
}
