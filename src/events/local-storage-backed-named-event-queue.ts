import { applicationLogger } from '@eppo/js-client-sdk-common';
import NamedEventQueue from '@eppo/js-client-sdk-common/dist/events/named-event-queue';

import { takeWhile } from '../util';

/** A localStorage-backed NamedEventQueue. */
export default class LocalStorageBackedNamedEventQueue<T> implements NamedEventQueue<T> {
  private readonly localStorageKey: string;
  private eventKeys: string[] = [];

  constructor(public readonly name: string) {
    this.localStorageKey = `eventQueue:${this.name}`;
    this.loadStateFromLocalStorage();
  }

  splice(count: number): T[] {
    const arr = Array.from({ length: count }, () => this.shift());
    return takeWhile(arr, (item) => item !== undefined) as T[];
  }

  isEmpty(): boolean {
    return this.length === 0;
  }

  get length(): number {
    return this.eventKeys.length;
  }

  push(event: T): void {
    const eventKey = this.generateEventKey(event);
    const serializedEvent = JSON.stringify(event);
    localStorage.setItem(eventKey, serializedEvent);
    this.eventKeys.push(eventKey);
    this.saveStateToLocalStorage();
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (const key of this.eventKeys) {
      const eventData = localStorage.getItem(key);
      if (eventData) {
        yield JSON.parse(eventData);
      }
    }
  }

  shift(): T | undefined {
    if (this.eventKeys.length === 0) {
      return undefined;
    }
    const eventKey = this.eventKeys.shift();
    if (!eventKey) {
      throw new Error('Unexpected undefined event key');
    }
    const eventData = localStorage.getItem(eventKey);
    if (eventData) {
      localStorage.removeItem(eventKey);
      this.saveStateToLocalStorage();
      return JSON.parse(eventData);
    }
    return undefined;
  }

  private loadStateFromLocalStorage(): void {
    const serializedState = localStorage.getItem(this.localStorageKey);
    if (serializedState) {
      try {
        this.eventKeys = JSON.parse(serializedState);
      } catch {
        applicationLogger.error(
          `Failed to parse event queue ${this.name} state. Initializing empty queue.`,
        );
        this.eventKeys = [];
      }
    }
  }

  private saveStateToLocalStorage(): void {
    const serializedState = JSON.stringify(this.eventKeys);
    localStorage.setItem(this.localStorageKey, serializedState);
  }

  private generateEventKey(event: T): string {
    const hash = this.hashEvent(event);
    return `eventQueue:${this.name}:${hash}`;
  }

  private hashEvent(event: T): string {
    const serializedEvent = JSON.stringify(event);
    let hash = 0;
    for (let i = 0; i < serializedEvent.length; i++) {
      hash = (hash << 5) - hash + serializedEvent.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
