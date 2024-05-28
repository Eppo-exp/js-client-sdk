import { IAsyncStore } from '@eppo/js-client-sdk-common';

/*
 * Removing stale keys is facilitating by storing the entire configuration into a single
 * key in local storage. This is done by serializing the entire configuration object
 * into a string and then storing it to a single key. When retrieving the configuration,
 * we first check if the configuration exists in local storage. If it does, we deserialize
 * the configuration from the string and return it. If the configuration does not exist,
 * we return null.
 */
export class LocalStorageBackedAsyncStore<T> implements IAsyncStore<T> {
  private localStorageKey = 'eppo-configuration';
  private _isInitialized = false;

  constructor(private localStorage: Storage) {}

  isInitialized(): boolean {
    return this._isInitialized;
  }

  isExpired(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getEntries(): Promise<Record<string, T>> {
    const configuration = this.localStorage.getItem(this.localStorageKey);
    if (!configuration) {
      return Promise.resolve({});
    }
    return Promise.resolve(JSON.parse(configuration));
  }

  setEntries(entries: Record<string, T>): Promise<void> {
    console.log('>>>> SETTING LOCAL STORAGE ENTRIES');
    this.localStorage.setItem(this.localStorageKey, JSON.stringify(entries));
    this._isInitialized = true;
    return Promise.resolve();
  }
}
