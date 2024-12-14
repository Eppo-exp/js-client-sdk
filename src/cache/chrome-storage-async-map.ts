import { applicationLogger, AsyncMap } from '@eppo/js-client-sdk-common';

/** Chrome storage-backed {@link AsyncMap}. */
export default class ChromeStorageAsyncMap<T> implements AsyncMap<string, T> {
  constructor(private readonly storage: chrome.storage.StorageArea) {}

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return !!value;
  }

  async get(key: string): Promise<T | undefined> {
    const subset = await this.storage.get(key);
    return subset?.[key] ?? undefined;
  }

  async entries(): Promise<{ [p: string]: T }> {
    return await this.storage.get(null);
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await this.storage.set({ [key]: value });
    } catch (error) {
      applicationLogger.warn('Chrome storage write failed for key:', key, error);
      throw error;
    }
  }
}
