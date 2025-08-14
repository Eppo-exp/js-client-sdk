import { WebCacheStorageEngine } from './web-cache-storage-engine';

describe('WebCacheStorageEngine', () => {
  let engine: WebCacheStorageEngine;
  let mockCache: jest.Mocked<Cache>;
  let mockCaches: jest.Mocked<CacheStorage>;
  let originalCaches: CacheStorage | undefined;

  beforeEach(() => {
    // Create mock Cache object
    mockCache = {
      match: jest.fn(),
      matchAll: jest.fn(),
      put: jest.fn(),
      add: jest.fn(),
      addAll: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
    } as jest.Mocked<Cache>;

    // Create mock CacheStorage object
    mockCaches = {
      open: jest.fn().mockResolvedValue(mockCache),
      delete: jest.fn(),
      has: jest.fn(),
      keys: jest.fn(),
      match: jest.fn(),
    } as jest.Mocked<CacheStorage>;

    // Store original caches and replace with mock
    originalCaches = (global as any).caches;
    (global as any).caches = mockCaches;

    engine = new WebCacheStorageEngine('test-suffix');

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore original caches
    (global as any).caches = originalCaches;
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with cache name and key', () => {
      expect(engine).toBeInstanceOf(WebCacheStorageEngine);
    });

    it('should handle empty storage key suffix', () => {
      const defaultEngine = new WebCacheStorageEngine();
      expect(defaultEngine).toBeInstanceOf(WebCacheStorageEngine);
    });
  });

  describe('getContentsJsonString', () => {
    it('should return cached content successfully', async () => {
      const testData = '{"test": "data"}';
      const mockResponse = new Response(testData);
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await engine.getContentsJsonString();

      expect(mockCaches.open).toHaveBeenCalledWith('eppo-sdk-test-suffix');
      expect(mockCache.match).toHaveBeenCalledWith('eppo-configuration-test-suffix');
      expect(result).toBe(testData);
    });

    it('should return null when no cached data exists', async () => {
      mockCache.match.mockResolvedValue(undefined);

      const result = await engine.getContentsJsonString();

      expect(result).toBeNull();
    });

    it('should return null when Cache API is not supported', async () => {
      (global as any).caches = undefined;

      const result = await engine.getContentsJsonString();

      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.match.mockRejectedValue(new Error('Cache error'));

      const result = await engine.getContentsJsonString();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('Failed to read from Web Cache API:', expect.any(Error));
    });
  });

  describe('setContentsJsonString', () => {
    it('should store content successfully', async () => {
      const testData = '{"test": "data"}';

      await engine.setContentsJsonString(testData);

      expect(mockCaches.open).toHaveBeenCalledWith('eppo-sdk-test-suffix');
      expect(mockCache.put).toHaveBeenCalledWith(
        'eppo-configuration-test-suffix',
        expect.any(Response)
      );

      // Verify the Response object has correct properties
      const putCall = mockCache.put.mock.calls[0];
      const response = putCall[1] as Response;
      expect(await response.text()).toBe(testData);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Stored-At')).toBeTruthy();
    });

    it('should throw error when Cache API is not supported', async () => {
      (global as any).caches = undefined;

      await expect(engine.setContentsJsonString('test')).rejects.toThrow('Cache API not supported');
    });

    it('should handle cache errors and log them', async () => {
      mockCache.put.mockRejectedValue(new Error('Cache write error'));

      await expect(engine.setContentsJsonString('test')).rejects.toThrow('Cache write error');
      expect(console.error).toHaveBeenCalledWith('Failed to write to Web Cache API:', expect.any(Error));
    });
  });

  describe('isExpired', () => {
    it('should return true when cooldown is 0', async () => {
      const result = await engine.isExpired(0);
      expect(result).toBe(true);
    });

    it('should return false for non-expired cache', async () => {
      const recentTime = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
      const testData = JSON.stringify({ createdAt: recentTime });
      const mockResponse = new Response(testData);
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await engine.isExpired(60); // 60 second cooldown

      expect(result).toBe(false);
    });

    it('should return true for expired cache', async () => {
      const oldTime = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      const testData = JSON.stringify({ createdAt: oldTime });
      const mockResponse = new Response(testData);
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await engine.isExpired(60); // 60 second cooldown

      expect(result).toBe(true);
    });

    it('should return true when no cached data exists', async () => {
      mockCache.match.mockResolvedValue(undefined);

      const result = await engine.isExpired(60);

      expect(result).toBe(true);
    });

    it('should return true when cached data has no createdAt', async () => {
      const testData = JSON.stringify({ someOtherField: 'value' });
      const mockResponse = new Response(testData);
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await engine.isExpired(60);

      expect(result).toBe(true);
    });

    it('should return true when cached data is invalid JSON', async () => {
      const mockResponse = new Response('invalid json');
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await engine.isExpired(60);

      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalledWith('Failed to check cache expiration:', expect.any(Error));
    });

    it('should handle cache read errors gracefully', async () => {
      jest.spyOn(engine, 'getContentsJsonString').mockRejectedValue(new Error('Read error'));

      const result = await engine.isExpired(60);

      expect(result).toBe(true);
      expect(console.warn).toHaveBeenCalledWith('Failed to check cache expiration:', expect.any(Error));
    });
  });

  describe('clear', () => {
    it('should clear cache successfully', async () => {
      await engine.clear();

      expect(mockCaches.delete).toHaveBeenCalledWith('eppo-sdk-test-suffix');
    });

    it('should handle missing Cache API gracefully', async () => {
      (global as any).caches = undefined;

      await engine.clear();

      // Should not throw error
    });

    it('should handle cache deletion errors gracefully', async () => {
      mockCaches.delete.mockRejectedValue(new Error('Delete error'));

      await engine.clear();

      expect(console.warn).toHaveBeenCalledWith('Failed to clear Web Cache API:', expect.any(Error));
    });
  });

  describe('integration scenarios', () => {
    it('should handle full read-write-expire cycle', async () => {
      const testData = JSON.stringify({
        createdAt: new Date().toISOString(),
        flags: { testFlag: true }
      });

      // Write data
      await engine.setContentsJsonString(testData);

      // Read data back
      const mockResponse = new Response(testData);
      mockCache.match.mockResolvedValue(mockResponse);
      const readData = await engine.getContentsJsonString();
      expect(readData).toBe(testData);

      // Check expiration (should not be expired with short cooldown)
      const isExpired = await engine.isExpired(3600); // 1 hour
      expect(isExpired).toBe(false);
    });

    it('should work with different storage key suffixes', () => {
      const engine1 = new WebCacheStorageEngine('suffix1');
      const engine2 = new WebCacheStorageEngine('suffix2');

      // Engines should be independent (different cache names)
      expect(engine1).toBeInstanceOf(WebCacheStorageEngine);
      expect(engine2).toBeInstanceOf(WebCacheStorageEngine);
    });
  });
});