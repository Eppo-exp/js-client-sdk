/**
 * @jest-environment jsdom
 */

import { LocalStorageEngine } from './local-storage-engine';
import {
  StringValuedAsyncStore,
  StorageFullUnableToWrite,
  LocalStorageUnknownFailure,
} from './string-valued.store';

describe('LocalStorageStore', () => {
  // Note: window.localStorage is mocked for the node environment via the jsdom jest environment
  const localStorageEngine = new LocalStorageEngine(window.localStorage, 'test');
  interface ITestEntry {
    items: string[];
  }
  const config1 = {
    items: ['test', 'control', 'blue'],
  };
  const config2 = {
    items: ['red'],
  };

  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty object if entry is not present', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.entries()).toEqual({});
  });

  it('returns stored entries', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.entries()).toEqual({ key1: config1, key2: config2 });
  });

  it('is always expired without cooldown', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(true);
  });

  it('is not expired after entries are set until cooldown', async () => {
    const store = new StringValuedAsyncStore<ITestEntry>(localStorageEngine, 10);
    expect(await store.isExpired()).toBe(true);
    await store.setEntries({ key1: config1, key2: config2 });
    expect(await store.isExpired()).toBe(false);

    // advance time by 5 seconds
    await jest.advanceTimersByTimeAsync(5 * 1000);
    expect(await store.isExpired()).toBe(false);

    // advance time by 6 more seconds (11 total)
    await jest.advanceTimersByTimeAsync(6 * 1000);
    expect(await store.isExpired()).toBe(true);
  });

  it('stores independently based on key suffix', async () => {
    const localStorageEngineEngineA = new LocalStorageEngine(window.localStorage, 'A');
    const storeA = new StringValuedAsyncStore(localStorageEngineEngineA, 1);
    const localStorageEngineEngineB = new LocalStorageEngine(window.localStorage, 'B');
    const storeB = new StringValuedAsyncStore(localStorageEngineEngineB, 1);

    await storeA.setEntries({ theKey: 'A' });
    expect(await storeA.entries()).toEqual({ theKey: 'A' });
    expect(await storeA.isExpired()).toBe(false);
    expect(await storeB.entries()).toEqual({});
    expect(await storeB.isExpired()).toBe(true);

    await jest.advanceTimersByTimeAsync(2000);

    await storeB.setEntries({ theKey: 'B' });
    expect(await storeA.entries()).toEqual({ theKey: 'A' });
    expect(await storeA.isExpired()).toBe(true);
    expect(await storeB.entries()).toEqual({ theKey: 'B' });
    expect(await storeB.isExpired()).toBe(false);
  });

  describe('clear method', () => {
    it('should clear all eppo-configuration keys', () => {
      window.localStorage.setItem('eppo-configuration-test', 'value1');
      window.localStorage.setItem('eppo-configuration-other', 'value2');
      window.localStorage.setItem('other-key', 'value3');

      localStorageEngine.clear();

      expect(window.localStorage.getItem('eppo-configuration-test')).toBeNull();
      expect(window.localStorage.getItem('eppo-configuration-other')).toBeNull();
      expect(window.localStorage.getItem('other-key')).toBe('value3');
    });

    it('should handle empty storage', () => {
      window.localStorage.clear();
      expect(() => localStorageEngine.clear()).not.toThrow();
    });
  });

  describe('StorageFullUnableToWrite exception handling', () => {
    // We need to mock localStorage with a controllable length property for testing
    // The Storage interface has a read-only 'length' property, so we extend it with
    // a private '_length' property that we can modify in tests
    let mockLocalStorage: Storage & { _length: number };
    let localStorageEngineWithMock: LocalStorageEngine;

    beforeEach(() => {
      mockLocalStorage = {
        // Getter that returns the mockable length value
        // This allows us to control the length for testing different scenarios
        get length() {
          return this._length || 0;
        },
        // Private property that we can modify to simulate different storage states
        _length: 0,
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        key: jest.fn(),
      } as Storage & { _length: number };
      localStorageEngineWithMock = new LocalStorageEngine(mockLocalStorage, 'test');
    });

    it('should throw StorageFullUnableToWrite when setContentsJsonString fails after clear and retry', async () => {
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw quotaError;
      });
      (mockLocalStorage.key as jest.Mock).mockReturnValue(null);
      // Simulate empty storage by setting length to 0
      mockLocalStorage._length = 0;

      await expect(localStorageEngineWithMock.setContentsJsonString('test-config')).rejects.toThrow(
        StorageFullUnableToWrite,
      );
    });

    it('should throw StorageFullUnableToWrite when setMetaJsonString fails after clear and retry', async () => {
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw quotaError;
      });
      (mockLocalStorage.key as jest.Mock).mockReturnValue(null);
      // Simulate empty storage by setting length to 0
      mockLocalStorage._length = 0;

      await expect(localStorageEngineWithMock.setMetaJsonString('test-meta')).rejects.toThrow(
        StorageFullUnableToWrite,
      );
    });

    it('should succeed after clearing when retry works', async () => {
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      let callCount = 0;
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw quotaError;
        }
        // Second call succeeds
      });
      (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-old');
      // Simulate storage with one item by setting length to 1
      mockLocalStorage._length = 1;

      await expect(
        localStorageEngineWithMock.setContentsJsonString('test-config'),
      ).resolves.not.toThrow();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-old');
      // setItem is called 3 times: 1) migration during construction, 2) first attempt (fails), 3) retry after clearing (succeeds)
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('should throw LocalStorageUnknownFailure for non-quota errors', async () => {
      const otherError = new Error('Some other error');
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw otherError;
      });

      const error = await localStorageEngineWithMock
        .setContentsJsonString('test-config')
        .catch((e) => e);
      expect(error).toBeInstanceOf(LocalStorageUnknownFailure);
      expect(error.originalError).toBe(otherError);
      expect(error.message).toContain('Some other error');
    });
  });
});
