import { IAsyncStore } from '@eppo/js-client-sdk-common';

export abstract class AbstractStringValuedAsyncStore<T> implements IAsyncStore<T> {
  protected configurationKey = 'eppo-configuration';
  protected metaKey = 'eppo-configuration-meta';
  private initialized = false;

  protected constructor(private cooldownSeconds = 0) {}

  public isInitialized(): boolean {
    return this.initialized;
  }

  protected abstract getConfigurationJsonString: () => Promise<string | null>;
  protected abstract getMetaConfigurationJsonString: () => Promise<string | null>;
  protected abstract setConfigurationJsonString: (configurationJsonString: string) => Promise<void>;
  protected abstract setMetaJsonString: (metaJsonString: string) => Promise<void>;

  public async isExpired(): Promise<boolean> {
    if (!this.cooldownSeconds) {
      return true;
    }

    const metaJsonString = await this.getMetaConfigurationJsonString();
    let isExpired = true;
    if (metaJsonString) {
      const parsedMeta = JSON.parse(metaJsonString);
      const lastUpdatedAt = parsedMeta.lastUpdatedAtMs;
      isExpired = !lastUpdatedAt || Date.now() - lastUpdatedAt > this.cooldownSeconds * 1000;
    }
    return isExpired;
  }

  public async getEntries(): Promise<Record<string, T>> {
    const configurationJsonString = await this.getConfigurationJsonString();
    const parsedConfiguration = configurationJsonString ? JSON.parse(configurationJsonString) : {};
    return parsedConfiguration;
  }

  public async setEntries(entries: Record<string, T>): Promise<void> {
    // String-based storage takes a dictionary of key-value string pairs,
    // so we write the entire configuration and meta to a single location for each.
    await this.setConfigurationJsonString(JSON.stringify(entries));
    const updatedMeta = { lastUpdatedAtMs: new Date().getTime() };
    await this.setMetaJsonString(JSON.stringify(updatedMeta));
    this.initialized = true;
  }
}
