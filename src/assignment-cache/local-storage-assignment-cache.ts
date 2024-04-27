import { AssignmentCache } from '@eppo/js-client-sdk-common';

import { hasWindowLocalStorage } from '../configuration-storage/configuration-storage-factory';

class LocalStorageAssignmentShim {
  LOCAL_STORAGE_KEY = 'EPPO_LOCAL_STORAGE_ASSIGNMENT_CACHE';

  public has(key: string): boolean {
    if (!hasWindowLocalStorage()) {
      return false;
    }

    return this.getCache().has(key);
  }

  public get(key: string): string {
    if (!hasWindowLocalStorage()) {
      return null;
    }

    return this.getCache().get(key);
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
    const cache = window.localStorage.getItem(this.LOCAL_STORAGE_KEY);
    return cache ? new Map(JSON.parse(cache)) : new Map();
  }

  private setCache(cache: Map<string, string>) {
    window.localStorage.setItem(
      this.LOCAL_STORAGE_KEY,
      JSON.stringify(Array.from(cache.entries())),
    );
  }
}

export class LocalStorageAssignmentCache extends AssignmentCache<LocalStorageAssignmentShim> {
  constructor() {
    super(new LocalStorageAssignmentShim());
  }
}
