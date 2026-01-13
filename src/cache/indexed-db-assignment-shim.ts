/**
 * IndexedDB-backed Map implementation for assignment cache.
 *
 * Stores the entire assignment cache as a single blob in IndexedDB for efficiency.
 * This provides better storage capacity (~50MB+) compared to localStorage (~5-10MB)
 * and better performance for large datasets through async operations.
 */
export class IndexedDBAssignmentShim implements Map<string, string> {
  private static readonly DB_NAME = 'eppo-sdk-storage';
  private static readonly DB_VERSION = 1;
  private static readonly ASSIGNMENTS_STORE = 'assignments';

  private readonly assignmentKey: string;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cache: Map<string, string> | null = null;

  public constructor(storageKeySuffix: string) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.assignmentKey = `eppo-assignment${keySuffix}`;
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
        IndexedDBAssignmentShim.DB_NAME,
        IndexedDBAssignmentShim.DB_VERSION,
      );

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create assignments object store if it doesn't exist
        if (!db.objectStoreNames.contains(IndexedDBAssignmentShim.ASSIGNMENTS_STORE)) {
          db.createObjectStore(IndexedDBAssignmentShim.ASSIGNMENTS_STORE);
        }

        // Note: The config storage engine may have already created 'contents' and 'meta' stores
        // We only create 'assignments' here if needed
        if (!db.objectStoreNames.contains('contents')) {
          db.createObjectStore('contents');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Load the cache from IndexedDB.
   * Returns a cached Map if already loaded, otherwise fetches from IndexedDB.
   */
  private async getCache(): Promise<Map<string, string>> {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const db = await this.initDB();
      const transaction = db.transaction([IndexedDBAssignmentShim.ASSIGNMENTS_STORE], 'readonly');
      const store = transaction.objectStore(IndexedDBAssignmentShim.ASSIGNMENTS_STORE);
      const request = store.get(this.assignmentKey);

      return new Promise<Map<string, string>>((resolve, reject) => {
        request.onsuccess = () => {
          const data = request.result;
          if (data && Array.isArray(data)) {
            this.cache = new Map(data);
            resolve(this.cache);
          } else {
            this.cache = new Map();
            resolve(this.cache);
          }
        };
        request.onerror = () => {
          // On error, return empty map
          this.cache = new Map();
          resolve(this.cache);
        };
      });
    } catch (error) {
      // If IndexedDB fails, return empty map
      this.cache = new Map();
      return this.cache;
    }
  }

  /**
   * Persist the cache to IndexedDB as a blob.
   * Stores the Map as a JSON-serialized array of entries.
   */
  private async setCache(cache: Map<string, string>): Promise<void> {
    this.cache = cache;

    try {
      const db = await this.initDB();
      const transaction = db.transaction([IndexedDBAssignmentShim.ASSIGNMENTS_STORE], 'readwrite');
      const store = transaction.objectStore(IndexedDBAssignmentShim.ASSIGNMENTS_STORE);

      // Serialize the Map as an array of entries for efficient blob storage
      const data = Array.from(cache.entries());
      const request = store.put(data, this.assignmentKey);

      return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          // Silently fail on write errors - assignment cache is not critical
          resolve();
        };
      });
    } catch (error) {
      // Silently fail on errors - assignment cache is not critical
      return Promise.resolve();
    }
  }

  // Map interface implementation - all methods are synchronous wrappers around async operations
  // The cache is loaded once and kept in memory for fast synchronous access

  clear(): void {
    this.cache = new Map();
    this.setCache(this.cache).catch(() => {
      // Ignore errors
    });
  }

  delete(key: string): boolean {
    if (this.cache === null) {
      return false;
    }
    const result = this.cache.delete(key);
    if (result) {
      this.setCache(this.cache).catch(() => {
        // Ignore errors
      });
    }
    return result;
  }

  forEach(
    callbackfn: (value: string, key: string, map: Map<string, string>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    if (this.cache !== null) {
      this.cache.forEach(callbackfn, thisArg);
    }
  }

  get size(): number {
    return this.cache?.size ?? 0;
  }

  entries(): IterableIterator<[string, string]> {
    return (this.cache ?? new Map()).entries();
  }

  keys(): IterableIterator<string> {
    return (this.cache ?? new Map()).keys();
  }

  values(): IterableIterator<string> {
    return (this.cache ?? new Map()).values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return (this.cache ?? new Map())[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return 'IndexedDBAssignmentShim';
  }

  public has(key: string): boolean {
    return this.cache?.has(key) ?? false;
  }

  public get(key: string): string | undefined {
    return this.cache?.get(key);
  }

  public set(key: string, value: string): this {
    if (this.cache === null) {
      this.cache = new Map();
    }
    this.cache.set(key, value);
    this.setCache(this.cache).catch(() => {
      // Ignore errors
    });
    return this;
  }

  /**
   * Initialize the cache by loading from IndexedDB.
   * This should be called during SDK initialization to warm up the cache.
   */
  public async init(): Promise<void> {
    await this.getCache();
  }
}
