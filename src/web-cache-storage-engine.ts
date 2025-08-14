import { IConfigurationStorageEngine } from './configuration-store';
import { CONFIGURATION_KEY } from './storage-key-constants';

/**
 * Web Cache API implementation for storing configuration data.
 *
 * Uses the Cache API for better storage limits and performance compared to localStorage.
 * Since the configuration response includes a createdAt timestamp, no separate metadata storage is needed.
 */
export class WebCacheStorageEngine implements IConfigurationStorageEngine {
  private readonly cacheKey: string;
  private readonly cacheName: string;

  public constructor(storageKeySuffix = '') {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.cacheName = `eppo-sdk${keySuffix}`;
    this.cacheKey = CONFIGURATION_KEY + keySuffix;
  }

  public getContentsJsonString = async (): Promise<string | null> => {
    try {
      // Check if Cache API is supported
      if (typeof caches === 'undefined') {
        return null;
      }

      const cache = await caches.open(this.cacheName);
      const response = await cache.match(this.cacheKey);

      if (!response) {
        return null;
      }

      return await response.text();
    } catch (error) {
      console.warn('Failed to read from Web Cache API:', error);
      return null;
    }
  };

  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    try {
      // Check if Cache API is supported
      if (typeof caches === 'undefined') {
        throw new Error('Cache API not supported');
      }

      const cache = await caches.open(this.cacheName);

      // Create a Response object to store in cache
      const response = new Response(configurationJsonString, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Stored-At': new Date().toISOString(),
        },
      });

      await cache.put(this.cacheKey, response);
    } catch (error) {
      console.error('Failed to write to Web Cache API:', error);
      throw error;
    }
  };

  /**
   * Check if the cached configuration has expired based on its createdAt timestamp
   */
  public async isExpired(cooldownSeconds: number): Promise<boolean> {
    if (!cooldownSeconds) {
      return true;
    }

    try {
      const configString = await this.getContentsJsonString();
      if (!configString) {
        return true;
      }

      const config = JSON.parse(configString);
      const createdAt = config.createdAt;

      if (!createdAt) {
        return true;
      }

      const createdAtMs = new Date(createdAt).getTime();
      return Date.now() - createdAtMs > cooldownSeconds * 1000;
    } catch (error) {
      console.warn('Failed to check cache expiration:', error);
      return true;
    }
  }

  /**
   * Clear all cached data for this storage engine
   */
  public async clear(): Promise<void> {
    try {
      if (typeof caches === 'undefined') {
        return;
      }

      await caches.delete(this.cacheName);
    } catch (error) {
      console.warn('Failed to clear Web Cache API:', error);
    }
  }
}
