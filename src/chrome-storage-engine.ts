import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import { IStringStorageEngine } from './string-valued.store';

/**
 * Chrome storage implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This serializes the entire configuration object into a string and then stores it to a single key
 * within the object for another single top-level key.
 * Same with metadata about the store (e.g., when it was last updated).
 */
export class ChromeStorageEngine implements IStringStorageEngine {
  private chromeStorageKey = 'eppo-sdk';

  public constructor(private storageArea: chrome.storage.StorageArea) {}

  public getContentsJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[CONFIGURATION_KEY] ?? null;
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    const storage = await this.storageArea.get(this.chromeStorageKey);
    return storage?.[META_KEY] ?? null;
  };

  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [CONFIGURATION_KEY]: configurationJsonString,
    });
  };

  public setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    await this.storageArea.set({
      [META_KEY]: metaJsonString,
    });
  };
}
