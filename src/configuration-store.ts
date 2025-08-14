import { IAsyncStore } from '@eppo/js-client-sdk-common';

/**
 * Simplified storage engine interface for configuration data with built-in timestamps.
 * Unlike IStringStorageEngine, this doesn't require separate metadata storage since
 * configuration responses include createdAt timestamps.
 */
export interface IConfigurationStorageEngine {
  getContentsJsonString: () => Promise<string | null>;
  setContentsJsonString: (configurationJsonString: string) => Promise<void>;
}

/**
 * Configuration store that works with storage engines optimized for configuration data.
 * Uses the configuration response's built-in createdAt timestamp for expiration logic
 * instead of maintaining separate metadata.
 */
export class ConfigurationAsyncStore<T> implements IAsyncStore<T> {
  private initialized = false;

  public constructor(
    private storageEngine: IConfigurationStorageEngine,
    private cooldownSeconds = 0,
  ) {}

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async isExpired(): Promise<boolean> {
    if (!this.cooldownSeconds) {
      return true;
    }

    try {
      const contentsJsonString = await this.storageEngine.getContentsJsonString();
      if (!contentsJsonString) {
        return true;
      }

      const contents = JSON.parse(contentsJsonString);
      
      // Check if this is a configuration response with createdAt
      if (contents.createdAt) {
        const createdAtMs = new Date(contents.createdAt).getTime();
        return Date.now() - createdAtMs > this.cooldownSeconds * 1000;
      }

      // Fallback: if no createdAt, consider expired
      return true;
    } catch (error) {
      console.warn('Failed to check expiration:', error);
      return true;
    }
  }

  public async entries(): Promise<Record<string, T>> {
    const contentsJsonString = await this.storageEngine.getContentsJsonString();
    return contentsJsonString ? JSON.parse(contentsJsonString) : {};
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    // Store the entire configuration response as-is
    await this.storageEngine.setContentsJsonString(JSON.stringify(entries));
    this.initialized = true;
  }
}