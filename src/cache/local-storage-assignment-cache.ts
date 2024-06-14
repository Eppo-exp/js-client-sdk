import { AbstractAssignmentCache } from '@eppo/js-client-sdk-common';
import { AssignmentCacheKey } from '@eppo/js-client-sdk-common/dist/cache/assignment-cache';

import { hasWindowLocalStorage } from '../configuration-factory';

import { BulkReadAssignmentCache, BulkWriteAssignmentCache } from './hybrid-assignment-cache';

export class LocalStorageAssignmentCache
  extends AbstractAssignmentCache<LocalStorageAssignmentShim>
  implements BulkReadAssignmentCache, BulkWriteAssignmentCache
{
  constructor(storageKeySuffix: string) {
    super(new LocalStorageAssignmentShim(storageKeySuffix));
  }

  setEntries(entries: AssignmentCacheKey[]): void {
    entries.forEach((entry) => {
      if (entry) {
        this.set(entry);
      }
    });
  }

  getEntries(): Promise<AssignmentCacheKey[]> {
    // we can't use this.delegate directly here because AbstractAssignmentCache uses a custom key/value format for
    // storing AssignmentCacheKey entries in the cache.
    return Promise.resolve([] /** this.cache.keys() */);
  }
}

// noinspection JSUnusedGlobalSymbols (methods are used by common repository)
class LocalStorageAssignmentShim implements Map<string, string> {
  private readonly localStorageKey: string;

  public constructor(storageKeySuffix: string) {
    if (!hasWindowLocalStorage()) {
      throw new Error('LocalStorageAssignmentShim requires window.localStorage to be available');
    }
    const keySuffix = storageKeySuffix ? `-${storageKeySuffix}` : '';
    this.localStorageKey = `eppo-assignment${keySuffix}`;
  }

  clear(): void {
    this.getCache().clear();
  }

  delete(key: string): boolean {
    return this.getCache().delete(key);
  }

  forEach(
    callbackfn: (value: string, key: string, map: Map<string, string>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    this.getCache().forEach(callbackfn, thisArg);
  }

  size: number;

  entries(): IterableIterator<[string, string]> {
    return this.getCache().entries();
  }

  keys(): IterableIterator<string> {
    return this.getCache().keys();
  }

  values(): IterableIterator<string> {
    return this.getCache().values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.getCache()[Symbol.iterator]();
  }

  [Symbol.toStringTag]: string;

  public has(key: string): boolean {
    return this.getCache().has(key);
  }

  public get(key: string): string | undefined {
    return this.getCache().get(key) ?? undefined;
  }

  public set(key: string, value: string): this {
    const cache = this.getCache();
    cache.set(key, value);
    this.setCache(cache);
    return this;
  }

  private getCache(): Map<string, string> {
    const cache = window.localStorage.getItem(this.localStorageKey);
    return cache ? new Map(JSON.parse(cache)) : new Map();
  }

  private setCache(cache: Map<string, string>) {
    window.localStorage.setItem(this.localStorageKey, JSON.stringify(Array.from(cache.entries())));
  }
}
