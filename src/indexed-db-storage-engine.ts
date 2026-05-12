import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import {
  IStringStorageEngine,
  StorageFullUnableToWrite,
  LocalStorageUnknownFailure,
} from './string-valued.store';

/**
 * IndexedDB implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This provides an alternative to localStorage with significantly larger storage capacity
 * (gigabytes, browser-dependent, typically 10GB+) compared to localStorage's ~5-10MB limit.
 *
 * Configuration and metadata are stored as JSON strings, matching the IStringStorageEngine
 * interface contract. Chrome compresses IndexedDB values natively at the storage layer.
 *
 * The database uses a simple key-value structure with two object stores:
 * - 'contents': stores configuration data as JSON strings
 * - 'meta': stores metadata about the configuration (e.g., lastUpdatedAtMs)
 */
export class IndexedDBStorageEngine implements IStringStorageEngine {
  private static readonly DB_NAME = 'eppo-sdk-storage';
  private static readonly DB_VERSION = 1;
  private static readonly CONTENTS_STORE = 'contents';
  private static readonly META_STORE = 'meta';

  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly contentsKey: string;
  private readonly metaKey: string;

  public constructor(storageKeySuffix: string) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.contentsKey = CONFIGURATION_KEY + keySuffix;
    this.metaKey = META_KEY + keySuffix;
  }

  /**
   * Initialize the IndexedDB database and create object stores if needed.
   * This is called lazily on first access.
   */
  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(
        IndexedDBStorageEngine.DB_NAME,
        IndexedDBStorageEngine.DB_VERSION,
      );

      request.onerror = () => {
        reject(
          new LocalStorageUnknownFailure(
            `Failed to open IndexedDB: ${request.error?.message}`,
            request.error as Error,
          ),
        );
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(IndexedDBStorageEngine.CONTENTS_STORE)) {
          db.createObjectStore(IndexedDBStorageEngine.CONTENTS_STORE);
        }
        if (!db.objectStoreNames.contains(IndexedDBStorageEngine.META_STORE)) {
          db.createObjectStore(IndexedDBStorageEngine.META_STORE);
        }
        // Create assignments store for assignment cache (if not already created)
        if (!db.objectStoreNames.contains('assignments')) {
          db.createObjectStore('assignments');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Get a value from an object store by key.
   * Returns native objects directly from IndexedDB (no parsing needed).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async get(storeName: string, key: string): Promise<any | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<any | null>((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result ?? null);
        };
        request.onerror = () => {
          reject(
            new LocalStorageUnknownFailure(
              `Failed to read from IndexedDB: ${request.error?.message}`,
              request.error as Error,
            ),
          );
        };
      });
    } catch (error) {
      if (error instanceof LocalStorageUnknownFailure) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new LocalStorageUnknownFailure(
        `Failed to read from IndexedDB: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Set a value in an object store by key.
   * Stores native objects directly in IndexedDB using structured clone algorithm.
   * @throws StorageFullUnableToWrite when quota is exceeded
   * @throws LocalStorageUnknownFailure for other errors
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async set(storeName: string, key: string, value: any): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          // Check for quota exceeded error
          if (
            request.error &&
            (request.error.name === 'QuotaExceededError' ||
              (request.error as DOMException).code === DOMException.QUOTA_EXCEEDED_ERR)
          ) {
            reject(new StorageFullUnableToWrite());
          } else {
            reject(
              new LocalStorageUnknownFailure(
                `Failed to write to IndexedDB: ${request.error?.message}`,
                request.error as Error,
              ),
            );
          }
        };
      });
    } catch (error) {
      if (error instanceof StorageFullUnableToWrite || error instanceof LocalStorageUnknownFailure) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new LocalStorageUnknownFailure(
        `Failed to write to IndexedDB: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  public async getContentsJsonString(): Promise<string | null> {
    return this.get(IndexedDBStorageEngine.CONTENTS_STORE, this.contentsKey);
  }

  public async getMetaJsonString(): Promise<string | null> {
    return this.get(IndexedDBStorageEngine.META_STORE, this.metaKey);
  }

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  public async setContentsJsonString(configurationJsonString: string): Promise<void> {
    await this.set(IndexedDBStorageEngine.CONTENTS_STORE, this.contentsKey, configurationJsonString);
  }

  /**
   * @throws StorageFullUnableToWrite
   * @throws LocalStorageUnknownFailure
   */
  public async setMetaJsonString(metaJsonString: string): Promise<void> {
    await this.set(IndexedDBStorageEngine.META_STORE, this.metaKey, metaJsonString);
  }
}
