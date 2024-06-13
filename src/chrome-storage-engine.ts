import ChromeStorageAsyncMap from './cache/chrome-storage-async-map';
import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import { IStringStorageEngine } from './string-valued.store';

/**
 * Chrome storage implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This serializes the entire configuration object into a string and then stores it to a single key
 * within the object for another single top-level key.
 * Same with metadata about the store (e.g., when it was last updated).
 *
 * Note: this behaves a bit differently than local storage as the chrome storage API gets and sets
 * subsets of key-value pairs, so we have to dereference or re-specify the key.
 */
export class ChromeStorageEngine implements IStringStorageEngine {
  private readonly contentsKey;
  private readonly metaKey;

  public constructor(private storageMap: ChromeStorageAsyncMap, storageKeySuffix: string) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.contentsKey = CONFIGURATION_KEY + keySuffix;
    this.metaKey = META_KEY + keySuffix;
  }

  public getContentsJsonString = async (): Promise<string | null> => {
    const item = await this.storageMap.get(this.contentsKey);
    return item ?? null;
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    const item = await this.storageMap.get(this.metaKey);
    return item ?? null;
  };

  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    await this.storageMap.set(this.contentsKey, configurationJsonString);
  };

  public setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    await this.storageMap.set(this.metaKey, metaJsonString);
  };
}
