/**
 * @jest-environment jsdom
 */

import ChromeStorageAssignmentCache from './chrome-storage-assignment-cache';
import HybridAssignmentCache from './hybrid-assignment-cache';
import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

import StorageArea = chrome.storage.StorageArea;

import { waitForMs } from '@eppo/js-client-sdk-common/dist/util';

describe('HybridStorageAssignmentCache', () => {
  const fakeStore: Record<string, string> = {};

  const get = jest.fn((key?: string) => {
    return new Promise((resolve) => {
      if (!key) {
        resolve(fakeStore);
      } else {
        resolve({ [key]: fakeStore[key] });
      }
    });
  }) as jest.Mock;

  const set = jest.fn((items: { [key: string]: string }) => {
    return new Promise((resolve) => {
      Object.assign(fakeStore, items);
      resolve(undefined);
    });
  }) as jest.Mock;

  const mockChromeStorage = { get, set } as unknown as StorageArea;
  const localStorageCache = new LocalStorageAssignmentCache('test');
  const chromeStorageCache = new ChromeStorageAssignmentCache(mockChromeStorage);
  const hybridCache = new HybridAssignmentCache(localStorageCache, chromeStorageCache);

  it('has should return false if cache is empty', () => {
    const cacheKey = {
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'control',
    };
    hybridCache.init();
    expect(hybridCache.has(cacheKey)).toBeFalsy();
  });

  it('has should return true if cache key is present', () => {
    const cacheKey = {
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'control',
    };
    hybridCache.init();
    expect(hybridCache.has(cacheKey)).toBeFalsy();
    expect(localStorageCache.has(cacheKey)).toBeFalsy();
    hybridCache.set(cacheKey);
    expect(hybridCache.has(cacheKey)).toBeTruthy();
    expect(localStorageCache.has(cacheKey)).toBeTruthy();
  });

  it('should populate localStorageCache from chromeStorageCache', async () => {
    const cacheKey = {
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'control',
    };
    chromeStorageCache.set(cacheKey);
    expect(localStorageCache.has(cacheKey)).toBeFalsy();
    await hybridCache.init();
    expect(localStorageCache.has(cacheKey)).toBeTruthy();
  });
});
