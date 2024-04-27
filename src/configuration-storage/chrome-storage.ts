import { IAsyncStore } from '@eppo/js-client-sdk-common';

export class ChromeStore<T> implements IAsyncStore<T> {
  private chromeStorageKey = 'eppo-configuration';
  private _isInitialized = false;

  constructor(private storageArea: chrome.storage.StorageArea) {}

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public isExpired(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public async getEntries(): Promise<Record<string, T>> {
    const configuration = await this.storageArea.get(this.chromeStorageKey);
    if (configuration) {
      return Promise.resolve(JSON.parse(configuration[this.chromeStorageKey]));
    }
    return Promise.resolve({});
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    await this.storageArea.set({ [this.chromeStorageKey]: JSON.stringify(entries) });
    this._isInitialized = true;
    return Promise.resolve();
  }
}
