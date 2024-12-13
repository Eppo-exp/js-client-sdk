/// <reference types="chrome"/>

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
    it('should resolve when storage change event fires', async () => {
      const key = 'testKey';
      const value = 'testValue';

      // Mock successful storage.set
      (mockStorage.set as jest.Mock).mockResolvedValue(undefined);

      // Start the set operation
      const setPromise = storageMap.set(key, value);

      // Simulate the storage change event
      if (storedListener) {
        storedListener({ [key]: { newValue: value, oldValue: undefined } }, 'local');
      }

      // Wait for set to complete
      await setPromise;

      // Verify storage.set was called
      expect(mockStorage.set).toHaveBeenCalledWith({ [key]: value });
    });

    it('should reject on timeout', async () => {
      const key = 'testKey';
      const value = 'testValue';

      // Mock successful storage.set but don't trigger change event
      (mockStorage.set as jest.Mock).mockResolvedValue(undefined);

      // Attempt to set value
      const setPromise = storageMap.set(key, value);

      // Wait for timeout
      await expect(setPromise).rejects.toThrow('Chrome storage write timeout');
    });

    it('should reject if storage.set fails', async () => {
      const key = 'testKey';
      const value = 'testValue';

      // Mock failed storage.set
      const error = new Error('Storage error');
      (mockStorage.set as jest.Mock).mockRejectedValue(error);

      // Attempt to set value
      await expect(storageMap.set(key, value)).rejects.toThrow('Storage error');
    });

    it('should resolve when storage change event fires', async () => {
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
