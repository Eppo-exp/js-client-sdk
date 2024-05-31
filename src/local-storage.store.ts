import { AbstractStringValuedAsyncStore } from './abstract-string-valued.store';

/*
 * Removing stale keys is facilitating by storing the entire configuration into a single
 * key in local storage. This is done by serializing the entire configuration object
 * into a string and then storing it to a single key. When retrieving the configuration,
 * we first check if the configuration exists in local storage. If it does, we deserialize
 * the configuration from the string and return it. If the configuration does not exist,
 * we return null.
 */
export class LocalStorageBackedAsyncStore<T> extends AbstractStringValuedAsyncStore<T> {
  constructor(private localStorage: Storage, cooldownSeconds?: number) {
    super(cooldownSeconds);
  }

  protected getConfigurationJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.configurationKey);
  };

  protected getMetaConfigurationJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(this.metaKey);
  };

  protected setConfigurationJsonString = async (configurationJsonString: string): Promise<void> => {
    this.localStorage.setItem(this.configurationKey, configurationJsonString);
  };

  protected setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    this.localStorage.setItem(this.metaKey, metaJsonString);
  };
}
