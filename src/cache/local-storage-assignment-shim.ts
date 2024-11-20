// noinspection JSUnusedGlobalSymbols (methods are used by common repository)
import { hasWindowLocalStorage } from '../configuration-factory';

export class LocalStorageAssignmentShim implements Map<string, string> {
  private readonly localStorageKey: string;

  public constructor(storageKeySuffix: string) {
    if (!hasWindowLocalStorage()) {
      throw new Error('LocalStorage is not available');
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

  size: number = this.getCache().size;

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

  [Symbol.toStringTag]: string = this.getCache()[Symbol.toStringTag];

  public has(key: string): boolean {
    return this.getCache().has(key);
  }

  public get(key: string): string | undefined {
    return this.getCache().get(key) ?? undefined;
  }

  public set(key: string, value: string): this {
    return this.setCache(this.getCache().set(key, value));
  }

  private getCache(): Map<string, string> {
    const cache = window.localStorage.getItem(this.localStorageKey);
    return cache ? new Map(JSON.parse(cache)) : new Map();
  }

  private setCache(cache: Map<string, string>): this {
    window.localStorage.setItem(this.localStorageKey, JSON.stringify(Array.from(cache.entries())));
    return this;
  }
}
