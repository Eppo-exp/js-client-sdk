import { CONFIGURATION_KEY, META_KEY } from './constants';
import { StringValuedAsyncStore } from './string-valued.store';
import { IStorageEngine } from './types';

/*
 * Removing stale keys is facilitating by storing the entire configuration into a single
 * key in local storage. This is done by serializing the entire configuration object
 * into a string and then storing it to a single key. When retrieving the configuration,
 * we first check if the configuration exists in local storage. If it does, we deserialize
 * the configuration from the string and return it. If the configuration does not exist,
 * we return null.
 */
export class LocalStorageAsyncStore implements IStorageEngine {
  constructor(private localStorage: Storage) {}

  static createStringValuedStore = <T>(localStorage: Storage, cooldownSeconds: number) => {
    const localStorageStore = new LocalStorageAsyncStore(localStorage);
    return new StringValuedAsyncStore<T>(localStorageStore, cooldownSeconds);
  };

  getConfigurationJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(CONFIGURATION_KEY);
  };

  getMetaConfigurationJsonString = async (): Promise<string | null> => {
    return this.localStorage.getItem(META_KEY);
  };

  setConfigurationJsonString = async (configurationJsonString: string): Promise<void> => {
    this.localStorage.setItem(CONFIGURATION_KEY, configurationJsonString);
  };

  setMetaJsonString = async (metaJsonString: string): Promise<void> => {
    this.localStorage.setItem(META_KEY, metaJsonString);
  };
}
