import { LocalStorageEngine } from './local-storage-engine';

describe('LocalStorageEngine', () => {
  let mockLocalStorage: Storage;
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
    } as any;
    engine = new LocalStorageEngine(mockLocalStorage, 'test');
  });

  describe('setContentsJsonString', () => {
    it('should set item successfully when no error occurs', async () => {
      await engine.setContentsJsonString('test-config');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'eppo-configuration-test',
        'test-config',
      );
    });

    it('should clear eppo-configuration keys and retry on quota exceeded error', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      // Mock localStorage to have some eppo-configuration keys
      (mockLocalStorage as any)._length = 3;
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
        'test-config',
      );
    });

    it('should handle retry failure silently', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage as any)._length = 1;
      (mockLocalStorage.key as jest.Mock).mockReturnValue('eppo-configuration-old');

      // Both calls fail with quota error
      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw quotaError;
      });

      // Should not throw
      await expect(engine.setContentsJsonString('test-config')).resolves.toBeUndefined();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('eppo-configuration-old');
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle quota exceeded error by name', async () => {
      const quotaError = new DOMException('Quota exceeded');
      Object.defineProperty(quotaError, 'name', { value: 'QuotaExceededError' });

      (mockLocalStorage as any)._length = 1;
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

    it('should not handle non-quota errors', async () => {
      const securityError = new DOMException('Security error', 'SecurityError');

      (mockLocalStorage.setItem as jest.Mock).mockImplementation(() => {
        throw securityError;
      });

      // Should not clear keys for non-quota errors
      await engine.setContentsJsonString('test-config');

      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearEppoConfigurationKeys', () => {
    it('should only remove keys starting with eppo-configuration', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      Object.defineProperty(quotaError, 'code', { value: DOMException.QUOTA_EXCEEDED_ERR });

      (mockLocalStorage as any)._length = 5;
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
});
