/// <reference types="chrome"/>

import { applicationLogger } from '@eppo/js-client-sdk-common';

import ChromeStorageAsyncMap from './chrome-storage-async-map';

type StorageChangeListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) => void;

describe('ChromeStorageAsyncMap', () => {
  let storedListener: StorageChangeListener | null = null;

  const mockStorage = {
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as chrome.storage.StorageArea;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(applicationLogger, 'warn').mockImplementation();
    storedListener = null;
    global.chrome = {
      storage: {
        onChanged: {
          addListener: (listener: StorageChangeListener) => {
            storedListener = listener;
          },
          removeListener: jest.fn(),
        },
      },
    } as unknown as typeof chrome;
  });

  let storageMap: ChromeStorageAsyncMap<string>;

  beforeEach(() => {
    storageMap = new ChromeStorageAsyncMap(mockStorage);
  });

  describe('set', () => {
    it('should complete without error on timeout', async () => {
      const key = 'testKey';
      const value = 'testValue';

      // Mock successful storage.set but don't trigger change event
      (mockStorage.set as jest.Mock).mockResolvedValue(undefined);

      await storageMap.set(key, value);

      // Verify warning was logged
      expect(applicationLogger.warn).toHaveBeenCalledWith(
        'Chrome storage write timeout for key:',
        key,
      );
    }, 10000);

    it('should complete without error if storage.set fails', async () => {
      const key = 'testKey';
      const value = 'testValue';
      const error = new Error('Storage error');

      // Mock failed storage.set
      (mockStorage.set as jest.Mock).mockRejectedValue(error);

      await storageMap.set(key, value);

      // Verify warning was logged
      expect(applicationLogger.warn).toHaveBeenCalledWith(
        'Chrome storage write failed for key:',
        key,
        error,
      );
    });

    it('should ensure data integrity during write process', async () => {
      const key = 'testKey';
      const value = 'testValue';
      let writeCompleted = false;

      // Mock storage.get to return different values before and after the change event
      (mockStorage.get as jest.Mock).mockImplementation(async () => {
        if (!writeCompleted) {
          return {}; // Entry not yet written
        }
        return { [key]: value }; // Entry written after change event
      });

      // Mock successful storage.set
      (mockStorage.set as jest.Mock).mockResolvedValue(undefined);

      // Start the set operation
      const setPromise = storageMap.set(key, value);

      // Verify entry is not written yet
      expect(await storageMap.get(key)).toBeUndefined();

      // Simulate the storage change event
      if (storedListener) {
        writeCompleted = true;
        storedListener({ [key]: { newValue: value, oldValue: undefined } }, 'local');
      }

      // Wait for set to complete
      await setPromise;

      // Verify entry is now written
      expect(await storageMap.get(key)).toBe(value);
      expect(mockStorage.set).toHaveBeenCalledWith({ [key]: value });
    });
  });
});
