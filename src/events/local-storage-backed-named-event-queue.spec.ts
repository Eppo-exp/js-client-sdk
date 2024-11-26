/**
 * @jest-environment jsdom
 */

import LocalStorageBackedNamedEventQueue from './local-storage-backed-named-event-queue';

describe('LocalStorageBackedNamedEventQueue', () => {
  const queueName = 'testQueue';
  let queue: LocalStorageBackedNamedEventQueue<string>;

  beforeEach(() => {
    localStorage.clear();
    queue = new LocalStorageBackedNamedEventQueue(queueName);
  });

  it('should initialize with an empty queue', () => {
    expect(queue.length).toBe(0);
  });

  it('should persist and retrieve events correctly via push and iterator', () => {
    queue.push('event1');
    queue.push('event2');

    expect(queue.length).toBe(2);

    const events = Array.from(queue);
    expect(events).toEqual(['event1', 'event2']);
  });

  it('should persist and retrieve events correctly via push and shift', () => {
    queue.push('event1');
    queue.push('event2');

    const firstEvent = queue.shift();
    expect(firstEvent).toBe('event1');
    expect(queue.length).toBe(1);

    const secondEvent = queue.shift();
    expect(secondEvent).toBe('event2');
    expect(queue.length).toBe(0);
  });

  it('should remove events from localStorage after shift', () => {
    queue.push('event1');
    const eventKey = Object.keys(localStorage).find(
      (key) => key.includes(queueName) && localStorage.getItem(key)?.includes('event1'),
    );

    expect(eventKey).toBeDefined();
    queue.shift();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(localStorage.getItem(eventKey!)).toBeNull();
  });

  it('should reconstruct the queue from localStorage', () => {
    queue.push('event1');
    queue.push('event2');

    const newQueueInstance = new LocalStorageBackedNamedEventQueue<string>(queueName);
    expect(newQueueInstance.length).toBe(2);

    const events = Array.from(newQueueInstance);
    expect(events).toEqual(['event1', 'event2']);
  });

  it('should handle empty shift gracefully', () => {
    expect(queue.shift()).toBeUndefined();
  });

  it('should not fail if localStorage state is corrupted', () => {
    localStorage.setItem(`eventQueue:${queueName}`, '{ corrupted state }');

    const newQueueInstance = new LocalStorageBackedNamedEventQueue<string>(queueName);
    expect(newQueueInstance.length).toBe(0);
  });

  it('should handle events with the same content correctly using consistent hashing', () => {
    queue.push('event1');
    queue.push('event1'); // Push the same event content twice

    expect(queue.length).toBe(2);

    const events = Array.from(queue);
    expect(events).toEqual(['event1', 'event1']);
  });
});
