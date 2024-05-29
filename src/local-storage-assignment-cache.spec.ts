/**
 * @jest-environment jsdom
 */

import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

describe('LocalStorageAssignmentCache', () => {
  it('typical behavior', () => {
    const cache = new LocalStorageAssignmentCache();
    expect(
      cache.hasLoggedAssignment({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationKey: 'control',
      }),
    ).toEqual(false);

    cache.setLastLoggedAssignment({
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'control',
    });

    expect(
      cache.hasLoggedAssignment({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationKey: 'control',
      }),
    ).toEqual(true); // this key has been logged

    // change variation
    cache.setLastLoggedAssignment({
      subjectKey: 'subject-1',
      flagKey: 'flag-1',
      allocationKey: 'allocation-1',
      variationKey: 'variant',
    });

    expect(
      cache.hasLoggedAssignment({
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

    cacheA.setLastLoggedAssignment({
      variationKey: 'variation-A',
      ...constantAssignmentProperties,
    });

    expect(
      cacheA.hasLoggedAssignment({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);

    expect(
      cacheB.hasLoggedAssignment({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    cacheB.setLastLoggedAssignment({
      variationKey: 'variation-B',
      ...constantAssignmentProperties,
    });

    expect(
      cacheA.hasLoggedAssignment({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);

    expect(
      cacheB.hasLoggedAssignment({
        variationKey: 'variation-A',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    expect(
      cacheA.hasLoggedAssignment({
        variationKey: 'variation-B',
        ...constantAssignmentProperties,
      }),
    ).toEqual(false);

    expect(
      cacheB.hasLoggedAssignment({
        variationKey: 'variation-B',
        ...constantAssignmentProperties,
      }),
    ).toEqual(true);
  });
});
