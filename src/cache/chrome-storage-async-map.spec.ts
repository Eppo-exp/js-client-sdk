/// <reference types="chrome"/>

import { applicationLogger } from '@eppo/js-client-sdk-common';

import ChromeStorageAsyncMap from './chrome-storage-async-map';

describe('ChromeStorageAsyncMap', () => {
  const mockStorage = {
    set: jest.fn(),
  } as unknown as chrome.storage.StorageArea;

  let storageMap: ChromeStorageAsyncMap<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(applicationLogger, 'warn').mockImplementation();
    (mockStorage.set as jest.Mock).mockImplementation(() => Promise.resolve());
    storageMap = new ChromeStorageAsyncMap(mockStorage);
  });

  describe('set', () => {
    it('should store and retrieve values correctly', async () => {
      const key = 'testKey';
      const value = 'testValue';

      await storageMap.set(key, value);
      expect(mockStorage.set).toHaveBeenCalledWith({ [key]: value });
    });

    it('should propagate storage errors', async () => {
      const key = 'testKey';
      const value = 'testValue';
      const error = new Error('Storage error');

      (mockStorage.set as jest.Mock).mockRejectedValue(error);

      await expect(storageMap.set(key, value)).rejects.toThrow(error);
      expect(applicationLogger.warn).toHaveBeenCalledWith(
        'Chrome storage write failed for key:',
        key,
        error,
      );
    });

    it('should handle multiple keys independently', async () => {
      const key1 = 'testKey1';
      const value1 = 'testValue1';
      const key2 = 'testKey2';
      const value2 = 'testValue2';

      await storageMap.set(key1, value1);
      await storageMap.set(key2, value2);

      expect(mockStorage.set).toHaveBeenCalledWith({ [key1]: value1 });
      expect(mockStorage.set).toHaveBeenCalledWith({ [key2]: value2 });
    });
  });
});
