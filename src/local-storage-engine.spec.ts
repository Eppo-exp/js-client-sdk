/**
 * @jest-environment jsdom
 */

import * as LZString from 'lz-string';

import { LocalStorageEngine } from './local-storage-engine';
import { StorageFullUnableToWrite, LocalStorageUnknownFailure } from './string-valued.store';

describe('LocalStorageEngine', () => {
  let mockLocalStorage: Storage & { _length: number };
  let engine: LocalStorageEngine;

  beforeEach(() => {
    mockLocalStorage = {
      get length() {
        return this._length || 0;
      },
      _length: 0,
      clear: jest.fn(),
      getItem: jest.fn(),
      key: jest.fn(),
      removeItem: jest.fn(),
      setItem: jest.fn(),
    } as Storage & { _length: number };

    // Setup: migration already completed to avoid interference with basic functionality tests
    (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
      return null;
    });

    engine = new LocalStorageEngine(mockLocalStorage, 'test');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should set item successfully when no error occurs', async () => {
      await engine.setContentsJsonString('test-config');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'eppo-configuration-test',
        LZString.compressToBase64('test-config'),
      );
    });

    it('should clear eppo-configuration keys and retry on quota exceeded error', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      // Mock localStorage to have some eppo-configuration keys
      (mockLocalStorage as Storage & { _length: number })._length = 3;
      (mockLocalStorage.key as jest.Mock)
        .mockReturnValueOnce('eppo-configuration-old')
        .mockReturnValueOnce('other-key')
        .mockReturnValueOnce('eppo-configuration-meta-old');

      // First call fails with quota error, second call succeeds
      (mockLocalStorage.setItem as jest.Mock)
        .mockImplementationOnce(() => {
          throw quotaError;
        })
        .mockImplementationOnce(jest.fn()); // Success on retry

      await engine.setContentsJsonString('test-config');

      // Verify keys were collected and removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-old');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-meta-old');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-key');

      // Verify setItem was called twice (original + retry)
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(
        'eppo-configuration-test',
        LZString.compressToBase64('test-config'),
      );
    });

    it('should throw StorageFullUnableToWrite when retry fails', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage as Storage & { _length: number })._length = 1;
      (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-old');

      // Both calls fail with quota error
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw quotaError;
      });

      // Should throw StorageFullUnableToWrite
      await expect(engine.setContentsJsonString('test-config')).rejects.toThrow(
        StorageFullUnableToWrite,
      );

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-old');
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle quota exceeded error by name', async () => {
      const quotaError = new DOMException('Quota exceeded');
      Object.defineProperty(quotaError, 'name', { value: 'QuotaExceededError' });

      (mockLocalStorage as Storage & { _length: number })._length = 1;
      (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-test-key');

      (mockLocalStorage.setItem as jest.Mock)
        .mockImplementationOnce(() => {
          throw quotaError;
        })
        .mockImplementationOnce(jest.fn()); // Success on retry

      await engine.setContentsJsonString('test-config');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-test-key');
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should throw LocalStorageUnknownFailure for non-quota errors', async () => {
      const securityError = new DOMException('Security error', 'SecurityError');

      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw securityError;
      });

      // Should throw LocalStorageUnknownFailure for non-quota errors with original error preserved
      const error = await engine.setContentsJsonString('test-config').catch((e) => e);
      expect(error).toBeInstanceOf(LocalStorageUnknownFailure);
      expect(error.message).toContain('Security error');
      expect(error.originalError).toBeTruthy();
      expect(error.originalError.message).toBe('Security error');

      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearEppoConfigurationKeys', () => {
    it('should only remove keys starting with eppo-configuration', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage as Storage & { _length: number })._length = 5;
      (mockLocalStorage.key as jest.Mock)
        .mockReturnValueOnce('eppo-configuration')
        .mockReturnValueOnce('eppo-configuration-meta')
        .mockReturnValueOnce('eppo-overrides')
        .mockReturnValueOnce('other-app-data')
        .mockReturnValueOnce('eppo-configuration-custom');

      (mockLocalStorage.setItem as jest.Mock)
        .mockImplementationOnce(() => {
          throw quotaError;
        })
        .mockImplementationOnce(jest.fn()); // Success on retry

      await engine.setContentsJsonString('test-config');

      // Should remove eppo-configuration keys
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-meta');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-custom');

      // Should not remove other keys
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('eppo-overrides');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-app-data');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
    });
  });

  describe('Compression Migration', () => {
    let migrationEngine: LocalStorageEngine;

    beforeEach(() => {
      // Reset mocks for migration tests
      jest.clearAllMocks();
      mockLocalStorage = {
        get length() {
          return this._length || 0;
        },
        _length: 0,
        clear: jest.fn(),
        getItem: jest.fn(),
        key: jest.fn(),
        removeItem: jest.fn(),
        setItem: jest.fn(),
      } as Storage & { _length: number };
    });

    describe('Migration', () => {
      it('should run migration on first construction', () => {
        // Setup: no global meta exists (first time)
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return null;
          return null;
        });

        // Mock localStorage.length and key() for iteration
        (mockLocalStorage as Storage & { _length: number })._length = 3;
        (mockLocalStorage.key as jest.Mock).mockImplementation((index) => {
          const keys = ['eppo-configuration-abc123', 'eppo-configuration-meta-def456', 'other-key'];
          return keys[index] || null;
        });

        migrationEngine = new LocalStorageEngine(mockLocalStorage, 'test');

        // Should have removed configuration keys
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-abc123');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-meta-def456');
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-key');

        // Should have set global meta
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'eppo-meta',
          expect.stringContaining('"version":1'),
        );
      });

      it('should skip migration if already completed', () => {
        // Setup: migration already done
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          return null;
        });

        migrationEngine = new LocalStorageEngine(mockLocalStorage, 'test');

        // Should not have removed any keys
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      });

      it('should handle migration errors gracefully', () => {
        // Setup: no global meta, but error during migration
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return null;
          return null;
        });

        // Make removeItem throw an error
        (mockLocalStorage.removeItem as jest.Mock).mockImplementation(() => {
          throw new Error('Storage error');
        });

        (mockLocalStorage as Storage & { _length: number })._length = 1;
        (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-test');

        // Should not throw error, just continue silently
        expect(() => new LocalStorageEngine(mockLocalStorage, 'test')).not.toThrow();
      });
    });

    describe('Compression', () => {
      beforeEach(() => {
        // Setup: migration already completed
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          return null;
        });

        migrationEngine = new LocalStorageEngine(mockLocalStorage, 'test');
      });

      it('should compress data when storing', async () => {
        const testData = JSON.stringify({ flag: 'test-flag', value: 'test-value' });

        await migrationEngine.setContentsJsonString(testData);

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'eppo-configuration-test',
          LZString.compressToBase64(testData),
        );
      });

      it('should decompress data when reading', async () => {
        const testData = JSON.stringify({ flag: 'test-flag', value: 'test-value' });
        const compressedData = LZString.compressToBase64(testData);

        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          if (key === 'eppo-configuration-test') return compressedData;
          return null;
        });

        const result = await migrationEngine.getContentsJsonString();

        expect(result).toBe(testData);
      });

      it('should handle decompression errors gracefully', async () => {
        // Mock LZString.decompress to throw an error
        const decompressSpy = jest
          .spyOn(LZString, 'decompressFromBase64')
          .mockImplementation(() => {
            throw new Error('Decompression failed');
          });

        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          if (key === 'eppo-configuration-test') return 'corrupted-data';
          return null;
        });

        const result = await migrationEngine.getContentsJsonString();

        expect(result).toBe(null);
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-test');

        decompressSpy.mockRestore();
      });

      it('should store and retrieve meta data without compression', async () => {
        const metaData = JSON.stringify({ lastUpdated: Date.now() });

        await migrationEngine.setMetaJsonString(metaData);

        // Meta data should be stored uncompressed
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'eppo-configuration-meta-test',
          metaData,
        );

        // Test reading back
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          if (key === 'eppo-configuration-meta-test') return metaData;
          return null;
        });

        const result = await migrationEngine.getMetaJsonString();
        expect(result).toBe(metaData);
      });

      it('should return null for non-existent data', async () => {
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
          return null;
        });

        const contentsResult = await migrationEngine.getContentsJsonString();
        const metaResult = await migrationEngine.getMetaJsonString();

        expect(contentsResult).toBe(null);
        expect(metaResult).toBe(null);
      });
    });

    describe('Global Meta Management', () => {
      it('should parse valid global meta', () => {
        const validMeta = { version: 1, migratedAt: Date.now() };
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return JSON.stringify(validMeta);
          return null;
        });

        new LocalStorageEngine(mockLocalStorage, 'test');

        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('eppo-meta');
      });

      it('should handle corrupted global meta', () => {
        (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
          if (key === 'eppo-meta') return 'invalid-json';
          return null;
        });

        (mockLocalStorage as Storage & { _length: number })._length = 0;

        // Should not throw error, just continue silently with default version
        expect(() => new LocalStorageEngine(mockLocalStorage, 'test')).not.toThrow();
      });
    });

    describe('Space Optimization', () => {
      it('should actually compress large configuration data', () => {
        // Create a large configuration object with repetitive data
        const largeConfig = {
          flags: Array.from({ length: 100 }, (_, i) => ({
            flagKey: `test-flag-${i}`,
            variationType: 'STRING',
            allocations: [
              { key: 'control', value: 'control-value' },
              { key: 'treatment', value: 'treatment-value' },
            ],
            rules: [{ conditions: [{ attribute: 'userId', operator: 'MATCHES', value: '.*' }] }],
          })),
        };

        const originalJson = JSON.stringify(largeConfig);
        const compressedData = LZString.compressToBase64(originalJson);

        // Verify compression actually reduces size
        expect(compressedData.length).toBeLessThan(originalJson.length);

        // Verify compression ratio is reasonable (should be significant for repetitive JSON)
        const compressionRatio = compressedData.length / originalJson.length;
        expect(compressionRatio).toBeLessThan(0.5); // At least 50% compression
      });
    });
  });
});
