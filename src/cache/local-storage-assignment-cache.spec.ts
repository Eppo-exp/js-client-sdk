/**
 * @jest-environment jsdom
 */

import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

describe('LocalStorageAssignmentCache', () => {
  it('typical behavior', () => {
    const cache = new LocalStorageAssignmentCache('test');
    expect(
      cache.has({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationKey: 'control',
      }),
    ).toEqual(false);

    cache.set({
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'control',
    });

    expect(
      cache.has({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationKey: 'control',
      }),
    ).toEqual(true); // this key has been logged

    // change variation
    cache.set({
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'variant',
    });

    expect(
      cache.has({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationKey: 'control',
      }),
    ).toEqual(false); // this key has not been logged
  });

  it('can have independent caches', () => {
    const storageKeySuffixA = 'A';
    const storageKeySuffixB = 'B';
    const cacheA = new LocalStorageAssignmentCache(storageKeySuffixA);
    const cacheB = new LocalStorageAssignmentCache(storageKeySuffixB);

    const constantAssignmentProperties = {
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
    };

    cacheA.set({
      variationKey: 'variation-A',
      ...constantAssignmentProperties,
    });

    expect(
      cacheA.has({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);

    expect(
      cacheB.has({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    cacheB.set({
      variationKey: 'variation-B',
      ...constantAssignmentProperties,
    });

    expect(
      cacheA.has({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);

    expect(
      cacheB.has({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    expect(
      cacheA.has({
        variationKey: 'variation-B',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    expect(
      cacheB.has({
        variationKey: 'variation-B',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);
  });
});
