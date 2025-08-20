import { IAsyncStore } from '@eppo/js-client-sdk-common';

export class StorageFullUnableToWrite extends Error {
  constructor(message = 'Storage is full and unable to write.') {
    super(message);
    this.name = 'StorageFullUnableToWrite';
  }
}

export class LocalStorageUnknownFailure extends Error {
  constructor(
    message = 'Local storage operation failed for unknown reason.',
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'LocalStorageUnknownFailure';
  }
}

/**
 * Interface for a string-based storage engine which stores string contents as well as metadata
 * about those contents (e.g., when it was last updated)
 */
export interface IStringStorageEngine {
  getContentsJsonString: () => Promise<string | null>;
  getMetaJsonString: () => Promise<string | null>;
  setContentsJsonString: (configurationJsonString: string) => Promise<void>;
  setMetaJsonString: (metaJsonString: string) => Promise<void>;
}

/**
 * Asynchronous store that operates using a provided underlying engine that stores strings.
 * Example string-based storage engines include a browser's local storage, or a Chrome extension's
 * chrome storage.
 * Objects are stored by serializing to JSON strings, and then retrieved by deserializing.
 */
export class StringValuedAsyncStore<T> implements IAsyncStore<T> {
  private initialized = false;

  public constructor(
    private storageEngine: IStringStorageEngine,
    private cooldownSeconds = 0,
  ) {}

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async isExpired(): Promise<boolean> {
    if (!this.cooldownSeconds) {
      return true;
    }

    const metaJsonString = await this.storageEngine.getMetaJsonString();
    let isExpired = true;
    if (metaJsonString) {
      const parsedMeta = JSON.parse(metaJsonString);
      const lastUpdatedAt = parsedMeta.lastUpdatedAtMs;
      isExpired = !lastUpdatedAt || Date.now() - lastUpdatedAt > this.cooldownSeconds * 1000;
    }
    return isExpired;
  }

  public async entries(): Promise<Record<string, T>> {
    const contentsJsonString = await this.storageEngine.getContentsJsonString();
    return contentsJsonString ? JSON.parse(contentsJsonString) : {};
  }

  /**
   * @param entries
   * @throws StorageFullUnableToWrite
   */
  public async setEntries(entries: Record<string, T>): Promise<void> {
    // String-based storage takes a dictionary of key-value string pairs,
    // so we write the entire configuration and meta to a single location for each.
    await this.storageEngine.setContentsJsonString(JSON.stringify(entries));
    const updatedMeta = { lastUpdatedAtMs: new Date().getTime() };
    await this.storageEngine.setMetaJsonString(JSON.stringify(updatedMeta));
    this.initialized = true;
  }
}
