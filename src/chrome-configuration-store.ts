import { AbstractStringValuedConfigurationStore } from './abstract-string-valued-configuration.store';

export class ChromeStorageAsyncStore<T> extends AbstractStringValuedConfigurationStore<T> {
  private chromeStorageKey = 'eppo-sdk';

  constructor(private storageArea: chrome.storage.StorageArea, cooldownSeconds?: number) {
    super(cooldownSeconds);
  }

  protected getConfigurationJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[this.configurationKey] ?? null;
  };

  protected getMetaConfigurationJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[this.metaKey] ?? null;
  };

  protected setConfigurationJsonString = async (configurationJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [this.configurationKey]: configurationJsonString,
    });
  };

  protected setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [this.metaKey]: metaJsonString,
    });
  };
}
