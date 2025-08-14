/**
 * @jest-environment jsdom
 */

import * as LZString from 'lz-string';

import { LocalStorageEngine } from './local-storage-engine';

describe('LocalStorageEngine Compression Migration', () => {
  let mockLocalStorage: Storage;

  beforeEach(() => {
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      get length() {
        return this._length || 0;
      },
      key: jest.fn(),
      _length: 0,
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Migration', () => {
    it('should run migration on first construction', () => {
      // Setup: no global meta exists (first time)
      (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-meta') return null;
        return null;
      });

      // Mock localStorage.length and key() for iteration
      (mockLocalStorage as any)._length = 3;
      (mockLocalStorage.key as jest.Mock).mockImplementation((index) => {
        const keys = ['eppo-configuration-abc123', 'eppo-configuration-meta-def456', 'other-key'];
        return keys[index] || null;
      });

      new LocalStorageEngine(mockLocalStorage, 'test');

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

      new LocalStorageEngine(mockLocalStorage, 'test');

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

      (mockLocalStorage as any)._length = 1;
      (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-test');

      // Should not throw error, just continue silently
      expect(() => new LocalStorageEngine(mockLocalStorage, 'test')).not.toThrow();
    });
  });

  describe('Compression', () => {
    let engine: LocalStorageEngine;

    beforeEach(() => {
      // Setup: migration already completed
      (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
        return null;
      });

      engine = new LocalStorageEngine(mockLocalStorage, 'test');
    });

    it('should compress data when storing', async () => {
      const testData = JSON.stringify({ flag: 'test-flag', value: 'test-value' });

      await engine.setContentsJsonString(testData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'eppo-configuration-test',
        LZString.compress(testData),
      );
    });

    it('should decompress data when reading', async () => {
      const testData = JSON.stringify({ flag: 'test-flag', value: 'test-value' });
      const compressedData = LZString.compress(testData);

      (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
        if (key === 'eppo-configuration-test') return compressedData;
        return null;
      });

      const result = await engine.getContentsJsonString();

      expect(result).toBe(testData);
    });

    it('should handle decompression errors gracefully', async () => {
      // Mock LZString.decompress to throw an error
      const decompressSpy = jest.spyOn(LZString, 'decompress').mockImplementation(() => {
        throw new Error('Decompression failed');
      });

      (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
        if (key === 'eppo-configuration-test') return 'corrupted-data';
        return null;
      });

      const result = await engine.getContentsJsonString();

      expect(result).toBe(null);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-test');

      decompressSpy.mockRestore();
    });

    it('should store and retrieve meta data without compression', async () => {
      const metaData = JSON.stringify({ lastUpdated: Date.now() });

      await engine.setMetaJsonString(metaData);

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

      const result = await engine.getMetaJsonString();
      expect(result).toBe(metaData);
    });

    it('should return null for non-existent data', async () => {
      (mockLocalStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'eppo-meta') return JSON.stringify({ version: 1, migratedAt: Date.now() });
        return null;
      });

      const contentsResult = await engine.getContentsJsonString();
      const metaResult = await engine.getMetaJsonString();

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

      (mockLocalStorage as any)._length = 0;

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
      const compressedData = LZString.compress(originalJson);

      // Verify compression actually reduces size
      expect(compressedData.length).toBeLessThan(originalJson.length);

      // Verify compression ratio is reasonable (should be significant for repetitive JSON)
      const compressionRatio = compressedData.length / originalJson.length;
      expect(compressionRatio).toBeLessThan(0.5); // At least 50% compression
    });
  });
});
