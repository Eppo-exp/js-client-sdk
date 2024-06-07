import { AssignmentCache } from '@eppo/js-client-sdk-common';

import { hasWindowLocalStorage } from './configuration-factory';

export class LocalStorageAssignmentCache extends AssignmentCache<LocalStorageAssignmentShim> {
  constructor(storageKeySuffix: string) {
    super(new LocalStorageAssignmentShim(storageKeySuffix));
  }
}

// noinspection JSUnusedGlobalSymbols (methods are used by common repository)
class LocalStorageAssignmentShim {
  private readonly localStorageKey: string;

  public constructor(storageKeySuffix: string) {
    const keySuffix = storageKeySuffix ? '-' + storageKeySuffix : '';
    this.localStorageKey = 'eppo-assignment' + keySuffix;
  }

  public has(key: string): boolean {
    if (!hasWindowLocalStorage()) {
      return false;
    }

    return this.getCache().has(key);
  }

  public get(key: string): string | undefined {
    if (!hasWindowLocalStorage()) {
      return undefined;
    }

    return this.getCache().get(key) ?? undefined;
  }

  public set(key: string, value: string) {
    if (!hasWindowLocalStorage()) {
      return;
    }

    const cache = this.getCache();
    cache.set(key, value);
    this.setCache(cache);
  }

  private getCache(): Map<string, string> {
    const cache = window.localStorage.getItem(this.localStorageKey);
    return cache ? new Map(JSON.parse(cache)) : new Map();
  }

  private setCache(cache: Map<string, string>) {
    window.localStorage.setItem(this.localStorageKey, JSON.stringify(Array.from(cache.entries())));
  }
}
