import BrowserNetworkStatusListener from './browser-network-status-listener';

describe('BrowserNetworkStatusListener', () => {
  let originalNavigator: Navigator;
  let originalWindow: Window;

  beforeEach(() => {
    // Save original references
    originalNavigator = global.navigator;
    originalWindow = global.window;

    // Mock `navigator.onLine`
    Object.defineProperty(global, 'navigator', {
      value: { onLine: true },
      writable: true,
    });

    const listeners: Map<string, (offline: boolean) => void> = new Map();
    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: (evt: string, fn: () => void) => {
          listeners.set(evt, fn);
        },
        removeEventListener: () => null,
        dispatchEvent: (event: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const listener = listeners.get(event.type)!;
          listener(event.type === 'offline');
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore original references
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore test code
    // noinspection JSConstantReassignment
    global.navigator = originalNavigator;
    // noinspection JSConstantReassignment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore test code
    // noinspection JSConstantReassignment
    global.window = originalWindow;

    jest.clearAllMocks();
  });

  test('throws an error if instantiated outside a browser environment', () => {
    Object.defineProperty(global, 'window', { value: undefined });

    expect(() => new BrowserNetworkStatusListener()).toThrow(
      'BrowserNetworkStatusListener can only be used in a browser environment',
    );
  });

  test('correctly initializes offline state based on navigator.onLine', () => {
    // Online state
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore test code
    // noinspection JSConstantReassignment
    navigator.onLine = true;
    const listener = new BrowserNetworkStatusListener();
    expect(listener.isOffline()).toBe(false);

    // Offline state
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // noinspection JSConstantReassignment
    navigator.onLine = false;
    const offlineListener = new BrowserNetworkStatusListener();
    expect(offlineListener.isOffline()).toBe(true);
  });

  test('notifies listeners when offline event is triggered', async () => {
    const listener = new BrowserNetworkStatusListener();
    const mockCallback = jest.fn();

    listener.onNetworkStatusChange(mockCallback);

    // Simulate offline event
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mockCallback).toHaveBeenCalledWith(true);
  });

  test('notifies listeners when online event is triggered', async () => {
    const listener = new BrowserNetworkStatusListener();
    const mockCallback = jest.fn();

    listener.onNetworkStatusChange(mockCallback);

    // Simulate online event
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mockCallback).toHaveBeenCalledWith(false);
  });

  test('removes listeners and does not notify them after removal', () => {
    const listener = new BrowserNetworkStatusListener();
    const mockCallback = jest.fn();

    listener.onNetworkStatusChange(mockCallback);
    listener.removeNetworkStatusChange(mockCallback);

    // Simulate offline event
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);

    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('debounces notifications for rapid online/offline changes', () => {
    jest.useFakeTimers();
    const listener = new BrowserNetworkStatusListener();
    const mockCallback = jest.fn();

    listener.onNetworkStatusChange(mockCallback);

    // Simulate rapid online/offline changes
    const offlineEvent = new Event('offline');
    const onlineEvent = new Event('online');
    window.dispatchEvent(offlineEvent);
    window.dispatchEvent(onlineEvent);

    // Fast-forward time by less than debounce duration
    jest.advanceTimersByTime(100);

    expect(mockCallback).not.toHaveBeenCalled();

    // Fast-forward time past debounce duration
    jest.advanceTimersByTime(200);

    expect(mockCallback).toHaveBeenCalledWith(false); // Online state
    jest.useRealTimers();
  });
});
