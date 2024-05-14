/**
 * @jest-environment jsdom
 */

import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

describe('LocalStorageAssignmentCache', () => {
  it('desired behavior', () => {
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
});
