/**
 * @jest-environment jsdom
 */

import { IndexedDBStorageEngine } from './indexed-db-storage-engine';
import { StorageFullUnableToWrite, LocalStorageUnknownFailure } from './string-valued.store';

// Mock IndexedDB for testing
class MockIDBDatabase {
  objectStoreNames = {
    contains: jest.fn().mockReturnValue(false),
  };
  transaction = jest.fn();
  createObjectStore = jest.fn();
}

class MockIDBObjectStore {
  get = jest.fn();
  put = jest.fn();
}

class MockIDBTransaction {
  objectStore = jest.fn();
}

class MockIDBRequest {
  result: unknown = null;
  error: Error | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
}

describe('IndexedDBStorageEngine', () => {
  let mockDB: MockIDBDatabase;
  let mockStore: MockIDBObjectStore;
  let mockTransaction: MockIDBTransaction;
  let mockOpenRequest: MockIDBOpenDBRequest;
  let engine: IndexedDBStorageEngine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storedData: Map<string, any>;

  beforeEach(() => {
    storedData = new Map();
    mockDB = new MockIDBDatabase();
    mockStore = new MockIDBObjectStore();
    mockTransaction = new MockIDBTransaction();
    mockOpenRequest = new MockIDBOpenDBRequest();

    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockDB.transaction.mockReturnValue(mockTransaction);

    // Simulate IndexedDB storage
    mockStore.get.mockImplementation((key: string) => {
      const request = new MockIDBRequest();
      setTimeout(() => {
        request.result = storedData.get(key) ?? null;
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);
      return request;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockStore.put.mockImplementation((value: any, key: string) => {
      const request = new MockIDBRequest();
      setTimeout(() => {
        storedData.set(key, value);
        request.onsuccess?.({ target: request } as unknown as Event);
      }, 0);
      return request;
    });

    // Mock global indexedDB
    const mockIndexedDB = {
      open: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          mockOpenRequest.result = mockDB;
          // Simulate upgrade needed for new database
          mockOpenRequest.onupgradeneeded?.({
            target: mockOpenRequest,
          } as unknown as IDBVersionChangeEvent);
          mockOpenRequest.onsuccess?.({ target: mockOpenRequest } as unknown as Event);
        }, 0);
        return mockOpenRequest;
      }),
    };

    Object.defineProperty(global, 'indexedDB', {
      value: mockIndexedDB,
      writable: true,
    });

    engine = new IndexedDBStorageEngine('test');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JSON String Storage', () => {
    it('should store configuration as JSON string', async () => {
      const testConfig = { flag1: { key: 'flag1', enabled: true }, flag2: { key: 'flag2', enabled: false } };
      const configJson = JSON.stringify(testConfig);

      await engine.setContentsJsonString(configJson);

      // Verify the JSON string was stored directly
      const storedValue = storedData.get('eppo-configuration-test');
      expect(storedValue).toBe(configJson);
      expect(typeof storedValue).toBe('string');
    });

    it('should retrieve configuration as JSON string', async () => {
      const testConfig = { flag1: { key: 'flag1', enabled: true } };
      const configJson = JSON.stringify(testConfig);
      storedData.set('eppo-configuration-test', configJson);

      const result = await engine.getContentsJsonString();

      expect(result).toBe(configJson);
    });

    it('should return null when no configuration exists', async () => {
      const result = await engine.getContentsJsonString();

      expect(result).toBe(null);
    });

    it('should handle round-trip correctly', async () => {
      const testConfig = {
        'feature-flag': {
          key: 'feature-flag',
          enabled: true,
          variationType: 'BOOLEAN',
          allocations: [{ key: 'default', value: true }],
        },
      };
      const configJson = JSON.stringify(testConfig);

      await engine.setContentsJsonString(configJson);
      const result = await engine.getContentsJsonString();

      expect(result).toBe(configJson);
      expect(JSON.parse(result!)).toEqual(testConfig);
    });

    it('should handle complex nested configuration', async () => {
      const complexConfig = {
        flag1: {
          key: 'flag1',
          enabled: true,
          variations: {
            control: { key: 'control', value: 'a' },
            treatment: { key: 'treatment', value: 'b' },
          },
          allocations: [
            {
              key: 'allocation1',
              rules: [{ conditions: [{ attribute: 'userId', operator: 'MATCHES', value: '.*' }] }],
              splits: [{ variationKey: 'control', shards: [] }],
            },
          ],
        },
      };
      const configJson = JSON.stringify(complexConfig);

      await engine.setContentsJsonString(configJson);
      const result = await engine.getContentsJsonString();

      expect(result).toBe(configJson);
      expect(JSON.parse(result!)).toEqual(complexConfig);
    });
  });

  describe('Meta Storage', () => {
    it('should store and retrieve meta data', async () => {
      const metaData = JSON.stringify({ lastUpdatedAtMs: Date.now() });

      await engine.setMetaJsonString(metaData);

      // Meta is stored directly (it's already a string for interface compatibility)
      const storedMeta = storedData.get('eppo-configuration-meta-test');
      expect(storedMeta).toBe(metaData);
    });

    it('should return null when no meta exists', async () => {
      const result = await engine.getMetaJsonString();

      expect(result).toBe(null);
    });
  });

  describe('Error Handling', () => {

    it('should throw StorageFullUnableToWrite on quota exceeded', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      mockStore.put.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          request.error = quotaError;
          request.onerror?.({ target: request } as unknown as Event);
        }, 0);
        return request;
      });

      await expect(engine.setContentsJsonString('{"test": true}')).rejects.toThrow(
        StorageFullUnableToWrite,
      );
    });

    it('should throw LocalStorageUnknownFailure on other errors', async () => {
      const unknownError = new Error('Unknown error');

      mockStore.put.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          request.error = unknownError;
          request.onerror?.({ target: request } as unknown as Event);
        }, 0);
        return request;
      });

      await expect(engine.setContentsJsonString('{"test": true}')).rejects.toThrow(
        LocalStorageUnknownFailure,
      );
    });
  });

  describe('Storage Key Suffix', () => {
    it('should use correct key with suffix', async () => {
      const testConfig = { flag: { key: 'flag' } };

      await engine.setContentsJsonString(JSON.stringify(testConfig));

      expect(storedData.has('eppo-configuration-test')).toBe(true);
      expect(storedData.has('eppo-configuration')).toBe(false);
    });

    it('should use correct key without suffix', async () => {
      const engineNoSuffix = new IndexedDBStorageEngine('');
      const testConfig = { flag: { key: 'flag' } };

      await engineNoSuffix.setContentsJsonString(JSON.stringify(testConfig));

      expect(storedData.has('eppo-configuration')).toBe(true);
    });
  });
});
