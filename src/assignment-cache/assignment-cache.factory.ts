import { AssignmentCache } from '@eppo/js-client-sdk-common';
import {
  Cacheable,
  NonExpiringInMemoryAssignmentCache,
} from '@eppo/js-client-sdk-common/dist/assignment-cache';

import { hasWindowLocalStorage } from '../environment';

import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

export function assignmentCacheFactory(): AssignmentCache<Cacheable> {
  // todo: implement a chrome.storage cache after updating
  // the interface to be async.
  if (hasWindowLocalStorage()) {
    return new LocalStorageAssignmentCache();
  }

  // Since this is a client SDK we use the non-expiring cache.
  return new NonExpiringInMemoryAssignmentCache();
}
