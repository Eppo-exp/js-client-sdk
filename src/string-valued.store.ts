import { IAsyncStore } from '@eppo/js-client-sdk-common';

import { IStorageEngine } from './types';

export class StringValuedAsyncStore<T> implements IAsyncStore<T> {
  private initialized = false;

  constructor(private storageEngine: IStorageEngine, private cooldownSeconds = 0) {}

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async isExpired(): Promise<boolean> {
    if (!this.cooldownSeconds) {
      return true;
    }

    const metaJsonString = await this.storageEngine.getMetaConfigurationJsonString();
    let isExpired = true;
    if (metaJsonString) {
      const parsedMeta = JSON.parse(metaJsonString);
      const lastUpdatedAt = parsedMeta.lastUpdatedAtMs;
      isExpired = !lastUpdatedAt || Date.now() - lastUpdatedAt > this.cooldownSeconds * 1000;
    }
    return isExpired;
  }

  public async getEntries(): Promise<Record<string, T>> {
    const configurationJsonString = await this.storageEngine.getConfigurationJsonString();
    const parsedConfiguration = configurationJsonString ? JSON.parse(configurationJsonString) : {};
    return parsedConfiguration;
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    // String-based storage takes a dictionary of key-value string pairs,
    // so we write the entire configuration and meta to a single location for each.
    await this.storageEngine.setConfigurationJsonString(JSON.stringify(entries));
    const updatedMeta = { lastUpdatedAtMs: new Date().getTime() };
    await this.storageEngine.setMetaJsonString(JSON.stringify(updatedMeta));
    this.initialized = true;
  }
}
