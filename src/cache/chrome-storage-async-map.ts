import { AsyncMap } from '@eppo/js-client-sdk-common';

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
    return new Promise((resolve, reject) => {
      // Set up listener for this specific write
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes[key]) {
          chrome.storage.onChanged.removeListener(listener);
          resolve();
        }
      };

      chrome.storage.onChanged.addListener(listener);

      // Set a timeout in case the change event never fires
      const timeout = setTimeout(() => {
        chrome.storage.onChanged.removeListener(listener);
        reject(new Error('Chrome storage write timeout'));
      }, 1000); // 1 second timeout

      // Perform the write
      this.storage.set({ [key]: value }).catch((error) => {
        clearTimeout(timeout);
        chrome.storage.onChanged.removeListener(listener);
        reject(error);
      });
    });
  }
}
