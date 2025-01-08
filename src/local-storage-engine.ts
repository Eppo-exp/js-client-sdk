import { CONFIGURATION_KEY, META_KEY } from './storage-key-constants';
import { IStringStorageEngine } from './string-valued.store';

/**
 * Local storage implementation of a string-valued store for storing a configuration and its metadata.
 *
 * This serializes the entire contents into a single string and then stores it to a single local
 * storage key. Same with metadata about the store (e.g., when it was last updated).
 */
export class LocalStorageEngine implements IStringStorageEngine {
  private readonly contentsKey;
  private readonly metaKey;

  public constructor(
    private localStorage: Storage,
    storageKeySuffix: string,
  ) {
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.contentsKey = CONFIGURATION_KEY + keySuffix;
    this.metaKey = META_KEY + keySuffix;
  }

  public getContentsJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.contentsKey);
  };

  public getMetaJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.metaKey);
  };

  public setContentsJsonString = async (configurationJsonString: string): Promise<void> => {
    this.localStorage.setItem(this.contentsKey, configurationJsonString);
  };

  public setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    this.localStorage.setItem(this.metaKey, metaJsonString);
  };
}
