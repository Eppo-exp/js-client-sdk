import { AbstractAssignmentCache } from '@eppo/js-client-sdk-common';

import { hasWindowLocalStorage } from '../configuration-factory';

export class LocalStorageAssignmentCache extends AbstractAssignmentCache<LocalStorageAssignmentShim> {
  constructor(storageKeySuffix: string) {
    super(new LocalStorageAssignmentShim(storageKeySuffix));
  }
}

// noinspection JSUnusedGlobalSymbols (methods are used by common repository)
class LocalStorageAssignmentShim implements Map<string, string> {
  private readonly localStorageKey: string;

  public constructor(storageKeySuffix: string) {
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
    if (!hasWindowLocalStorage()) {
      return [][Symbol.iterator]();
    }
    return this.getCache().entries();
  }

  keys(): IterableIterator<string> {
    if (!hasWindowLocalStorage()) {
      return [][Symbol.iterator]();
    }
    return this.getCache().keys();
  }

  values(): IterableIterator<string> {
    if (!hasWindowLocalStorage()) {
      return [][Symbol.iterator]();
    }
    return this.getCache().values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    if (!hasWindowLocalStorage()) {
      return [][Symbol.iterator]();
    }
    return this.getCache()[Symbol.iterator]();
  }

  [Symbol.toStringTag]: string;

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

  public set(key: string, value: string): this {
    if (!hasWindowLocalStorage()) {
      return this;
    }

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
