import { AsyncMap } from '@eppo/js-client-sdk-common';

/** Chrome storage-backed {@link AsyncMap}. */
export default class ChromeStorageAsyncMap implements AsyncMap<string, string> {
  constructor(private readonly storage: chrome.storage.StorageArea) {}

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return !!value;
  }

  async get(key: string): Promise<string | undefined> {
    const subset = await this.storage.get(key);
    return subset?.[key] ?? undefined;
  }

  async entries(): Promise<{ [p: string]: string }> {
    return await this.storage.get(null);
  }

  async set(key: string, value: string) {
    await this.storage.set({ [key]: value });
  }
}
