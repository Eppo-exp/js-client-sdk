import { IConfigurationStore } from '@eppo/js-client-sdk-common';

/**
 * A local storage implementation that supports expiring entries.
 *
 * If `expirationSeconds` is defined, entries will be removed from
 * local storage after a certain amount of time has passed.
 *
 * Otherwise, the entries will never expire.
 */
export class EppoLocalStorage implements IConfigurationStore {
  private entryPrefix = 'eppo-entry-';
  private lastFetchedAtKey = 'eppo-last-fetched-at';

  constructor(private expirationSeconds?: number) {
    if (!hasWindowLocalStorage()) {
      console.warn(
        'EppoSDK cannot store experiment configurations as window.localStorage is not available',
      );
    }

    if (expirationSeconds <= 0) {
      throw new Error('Expiration seconds must be a positive integer');
    }
  }

  public get<T>(key: string): T {
    if (!hasWindowLocalStorage()) {
      return null;
    }

    const serializedEntry = window.localStorage.getItem(this.entryKey(key));
    if (!serializedEntry) {
      return null;
    }

    return JSON.parse(serializedEntry);
  }

  public setEntries<T>(entries: Record<string, T>) {
    if (!hasWindowLocalStorage()) {
      return;
    }

    // delete existing keys with prefix to recycle storage
    // if a flag has been removed from the config,
    // we need to remove it from local storage
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(this.entryPrefix)) {
        window.localStorage.removeItem(key);
      }
    });

    // set new keys
    Object.entries(entries).forEach(([key, val]) => {
      window.localStorage.setItem(this.entryKey(key), JSON.stringify(val));
    });

    if (this.expirationSeconds) {
      this.setLastFetchedAtMs(Date.now());
    }
  }

  public isExpired(): boolean {
    if (!hasWindowLocalStorage()) {
      return false;
    }

    if (!this.expirationSeconds) {
      return false;
    }

    const lastFetchedAt = this.getLastFetchedAtMs();
    return lastFetchedAt === 0 || lastFetchedAt + this.expirationSeconds * 1000 <= Date.now();
  }

  private getLastFetchedAtMs(): number {
    const lastFetchedAt = window.localStorage.getItem(this.lastFetchedAtKey);
    return lastFetchedAt ? Number(lastFetchedAt) : 0;
  }

  private setLastFetchedAtMs(timestamp: number) {
    window.localStorage.setItem(this.lastFetchedAtKey, String(timestamp));
  }

  private entryKey(key: string): string {
    return this.entryPrefix + key;
  }
}

// Checks whether local storage is enabled in the browser (the user might have disabled it).
export function hasWindowLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    // Chrome throws an error if local storage is disabled and you try to access it
    return false;
  }
}
