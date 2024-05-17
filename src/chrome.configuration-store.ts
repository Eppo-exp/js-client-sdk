import { IAsyncStore } from '@eppo/js-client-sdk-common';

export class ChromeStorageAsyncStore<T> implements IAsyncStore<T> {
  private chromeStorageKey = 'eppo-configuration';
  private _isInitialized = false;

  constructor(private storageArea: chrome.storage.StorageArea) {}

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public isExpired(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public async getEntries(): Promise<Record<string, T> | null> {
    const configuration = await this.storageArea.get(this.chromeStorageKey);
    if (configuration?.[this.chromeStorageKey]) {
      return Promise.resolve(JSON.parse(configuration[this.chromeStorageKey]));
    }
    return Promise.resolve(null);
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    // chrome.storage.set takes a dictionary of key-value pairs,
    // so we need to pass it an object with a single property.
    // writes the entire configuration to a single location.
    await this.storageArea.set({ [this.chromeStorageKey]: JSON.stringify(entries) });
    this._isInitialized = true;
    return Promise.resolve();
  }
}
