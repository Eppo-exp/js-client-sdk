import { NetworkStatusListener } from '@eppo/js-client-sdk-common';

const debounceDurationMs = 200;

/** A NetworkStatusListener that listens for online/offline events in the browser. */
export default class BrowserNetworkStatusListener implements NetworkStatusListener {
  private readonly listeners: ((isOffline: boolean) => void)[] = [];
  private _isOffline: boolean;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error('BrowserNetworkStatusListener can only be used in a browser environment');
    }
    // guard against navigator API not being available (oder browsers)
    // noinspection SuspiciousTypeOfGuard
    this._isOffline = typeof navigator.onLine === 'boolean' ? !navigator.onLine : false;
    window.addEventListener('offline', () => this.notifyListeners(true));
    window.addEventListener('online', () => this.notifyListeners(false));
  }

  isOffline(): boolean {
    return this._isOffline;
  }

  onNetworkStatusChange(callback: (isOffline: boolean) => void): void {
    this.listeners.push(callback);
  }

  removeNetworkStatusChange(callback: (isOffline: boolean) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(isOffline: boolean): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this._isOffline = isOffline;
      [...this.listeners].forEach((listener) => listener(isOffline));
    }, debounceDurationMs);
  }
}
