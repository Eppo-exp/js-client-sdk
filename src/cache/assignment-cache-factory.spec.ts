/**
 * @jest-environment jsdom
 */

import { assignmentCacheFactory } from './assignment-cache-factory';
import HybridAssignmentCache from './hybrid-assignment-cache';

import StorageArea = chrome.storage.StorageArea;

describe('AssignmentCacheFactory', () => {
  // TODO: Extract test-only function for this
  const fakeStore: { [k: string]: string } = {};

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

  beforeEach(() => {
    window.localStorage.clear();
    Object.keys(fakeStore).forEach((key) => delete fakeStore[key]);
  });

  it('should create a hybrid cache if chrome storage is available', () => {
    const cache = assignmentCacheFactory({
      chromeStorage: mockChromeStorage,
      storageKeySuffix: 'foo',
    });
    expect(cache).toBeInstanceOf(HybridAssignmentCache);
    expect(Object.keys(fakeStore)).toHaveLength(0);
    cache.set({ subjectKey: 'foo', flagKey: 'bar', allocationKey: 'baz', variationKey: 'qux' });
    expect(Object.keys(fakeStore)).toHaveLength(1);
  });

  it('should create a hybrid cache if local storage is available', () => {
    const cache = assignmentCacheFactory({
      storageKeySuffix: 'foo',
    });
    expect(cache).toBeInstanceOf(HybridAssignmentCache);
    expect(localStorage.length).toEqual(0);
    cache.set({ subjectKey: 'foo', flagKey: 'bar', allocationKey: 'baz', variationKey: 'qux' });
    // chrome storage is not being used
    expect(Object.keys(fakeStore)).toHaveLength(0);
    // local storage is being used
    expect(localStorage.length).toEqual(1);
  });
});
