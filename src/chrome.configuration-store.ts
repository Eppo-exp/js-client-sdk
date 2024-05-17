import { IAsyncStore } from '@eppo/js-client-sdk-common';

export class ChromeStorageAsyncStore<T> implements IAsyncStore<T> {
  private chromeStorageKey = 'eppo-configuration';
  private metaKey = 'eppo-configuration-meta';
  private _isInitialized = false;

  constructor(private storageArea: chrome.storage.StorageArea, private cooldownSeconds?: number) {}

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  public async isExpired(): Promise<boolean> {
    if (!this.cooldownSeconds) {
      return Promise.resolve(true);
    }

    const meta = await this.storageArea.get(this.metaKey);
    if (meta && meta[this.metaKey]) {
      const lastUpdatedAt = JSON.parse(meta[this.metaKey]).lastUpdatedAtMs;
      if (!lastUpdatedAt) {
        return Promise.resolve(true);
      }

      const now = Date.now();

      return Promise.resolve(now - lastUpdatedAt > this.cooldownSeconds * 1000);
    }

    return Promise.resolve(true);
  }

  public async getEntries(): Promise<Record<string, T>> {
    const configuration = await this.storageArea.get(this.chromeStorageKey);
    if (configuration && configuration[this.chromeStorageKey]) {
      return Promise.resolve(JSON.parse(configuration[this.chromeStorageKey]));
    }
    return Promise.resolve({});
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    await this.storageArea.set({
      [this.chromeStorageKey]: JSON.stringify(entries),
      [this.metaKey]: JSON.stringify({ lastUpdatedAtMs: new Date().getTime() }),
    });
    this._isInitialized = true;
    return Promise.resolve();
  }
}
