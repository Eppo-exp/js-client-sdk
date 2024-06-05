import { CONFIGURATION_KEY, META_KEY } from './constants';
import { StringValuedAsyncStore } from './string-valued.store';
import { IStorageEngine } from './types';

export class ChromeStorageAsyncStore implements IStorageEngine {
  private chromeStorageKey = 'eppo-sdk';

  constructor(private storageArea: chrome.storage.StorageArea) {}

  static createStringValuedStore = <T>(
    storageArea: chrome.storage.StorageArea,
    cooldownSeconds: number,
  ) => {
    return new StringValuedAsyncStore<T>(new ChromeStorageAsyncStore(storageArea), cooldownSeconds);
  };

  getConfigurationJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[CONFIGURATION_KEY] ?? null;
  };

  getMetaConfigurationJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[META_KEY] ?? null;
  };

  setConfigurationJsonString = async (configurationJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [CONFIGURATION_KEY]: configurationJsonString,
    });
  };

  setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [META_KEY]: metaJsonString,
    });
  };
}
