import { Flag, IAssignmentLogger, IAsyncStore } from '@eppo/js-client-sdk-common';

import { ServingStoreUpdateStrategy } from './isolatable-hybrid.store';

/**
 * Configuration used for initializing the Eppo client
 * @public
 */
export interface IClientConfig {
  /**
   * Eppo API key
   */
  apiKey: string;

  /**
   * Base URL of the Eppo API.
   * Clients should use the default setting in most cases.
   */
  baseUrl?: string;

  /**
   * Pass a logging implementation to send variation assignments to your data warehouse.
   */
  assignmentLogger: IAssignmentLogger;

  /***
   * Timeout in milliseconds for the HTTPS request for the experiment configuration. (Default: 5000)
   */
  requestTimeoutMs?: number;

  /**
   * Number of additional times the initial configuration request will be attempted if it fails.
   * This is the request typically synchronously waited (via await) for completion. A small wait will be
   * done between requests. (Default: 1)
   */
  numInitialRequestRetries?: number;

  /**
   * Throw an error if unable to fetch an initial configuration during initialization. (default: true)
   */
  throwOnFailedInitialization?: boolean;

  /**
   * Poll for new configurations even if the initial configuration request failed. (default: false)
   */
  pollAfterFailedInitialization?: boolean;

  /**
   * Poll for new configurations (every `pollingIntervalMs`) after successfully requesting the initial configuration. (default: false)
   */
  pollAfterSuccessfulInitialization?: boolean;

  /**
   * Amount of time to wait between API calls to refresh configuration data. Default of 30_000 (30 seconds).
   */
  pollingIntervalMs?: number;

  /**
   * Number of additional times polling for updated configurations will be attempted before giving up.
   * Polling is done after a successful initial request. Subsequent attempts are done using an exponential
   * backoff. (Default: 7)
   */
  numPollRequestRetries?: number;

  /**
   * Skip the request for new configurations during initialization. (default: false)
   */
  skipInitialRequest?: boolean;

  /**
   * Maximum age, in seconds, previously cached values are considered valid until new values will be
   * fetched (default: 0)
   */
  maxCacheAgeSeconds?: number;

  /**
   * Whether initialization will be considered successfully complete if expired cache values are
   * loaded. If false, initialization will always wait for a fetch if cached values are expired.
   * (default: false)
   */
  useExpiredCache?: boolean;

  /**
   * Sets how the configuration is updated after a successful fetch
   * - always: immediately start using the new configuration
   * - expired: immediately start using the new configuration only if the current one has expired
   * - empty: only use the new configuration if the current one is both expired and uninitialized/empty
   */
  updateOnFetch?: ServingStoreUpdateStrategy;

  /**
   * A custom class to use for storing flag configurations.
   * This is useful for cases where you want to use a different storage mechanism
   * than the default storage provided by the SDK.
   */
  persistentStore?: IAsyncStore<Flag>;

  /**
   * Force reinitialize the SDK if it is already initialized.
   */
  forceReinitialize?: boolean;
}