import {
  BanditSubjectAttributes,
  ContextAttributes,
  Flag,
  FlagKey,
  IAssignmentLogger,
  IAsyncStore,
  IBanditLogger,
  IConfigurationStore,
} from '@eppo/js-client-sdk-common';

import { ServingStoreUpdateStrategy } from './isolatable-hybrid.store';

/**
 * Base configuration for API requests and polling behavior
 */
interface IBaseRequestConfig {
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

  /**
   * Pass a logging implementation to send bandit assignments to your data warehouse.
   */
  banditLogger?: IBanditLogger;

  /**
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
}

/**
 * Configuration for precomputed flag assignments
 */
interface IPrecompute {
  /**
   * Subject key to use for precomputed flag assignments.
   */
  subjectKey: string;

  /**
   * Subject attributes to use for precomputed flag assignments.
   */
  subjectAttributes?: BanditSubjectAttributes;

  /**
   * Bandit actions to use for precomputed flag assignments.
   */
  banditActions?: Record<FlagKey, Record<string /*banditAction name*/, ContextAttributes>>;
}

/**
 * Configuration for Eppo precomputed client initialization
 * @public
 */
export interface IPrecomputedClientConfig extends IBaseRequestConfig {
  precompute: IPrecompute;

  /**
   * Enable the Overrides Store for local flag overrides.
   * (default: false)
   */
  enableOverrides?: boolean;

  /**
   * The key to use for the overrides store.
   */
  overridesStorageKey?: string;
}

/**
 * Base options for the EppoClient SDK
 */
export type IApiOptions = {
  /**
   * Your key for accessing Eppo through the Eppo SDK.
   *
   * Some persistent storage mechanisms use this key (hashed) to index saved Eppo configuration data.
   * It is not advisable to create multiple EppoClient instances with the same API key as they will each make network
   * call(s) (depending on the other request options in `IApiOptions`) while sharing the same persistent storage.
   */
  apiKey: string;

  /**
   * Override the endpoint the SDK uses to load configuration.
   */
  baseUrl?: string;

  /**
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
   * Skip the request for new configurations during initialization. (default: false)
   */
  skipInitialRequest?: boolean;

  /**
   * Throw an error if unable to fetch an initial configuration during initialization. (default: true)
   */
  throwOnFailedInitialization?: boolean;

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
};

/**
 * Wrapper for configuration settings for the event dispatcher
 */
export type IEventOptions = {
  /** Configuration settings for the event dispatcher */
  eventIngestionConfig?: {
    /** Number of milliseconds to wait between each batch delivery. Defaults to 10 seconds. */
    deliveryIntervalMs?: number;
    /** Minimum amount of milliseconds to wait before retrying a failed delivery. Defaults to 5 seconds */
    retryIntervalMs?: number;
    /** Maximum amount of milliseconds to wait before retrying a failed delivery. Defaults to 30 seconds. */
    maxRetryDelayMs?: number;
    /** Maximum number of retry attempts before giving up on a batch delivery. Defaults to 3 retries. */
    maxRetries?: number;
    /** Maximum number of events to send per delivery request. Defaults to 1000 events. */
    batchSize?: number;
    /**
     * Maximum number of events to queue in memory before starting to drop events.
     * Note: This is only used if localStorage is not available.
     * Defaults to 10000 events.
     */
    maxQueueSize?: number;
  };
};

/**
 * Custom storage instances.
 */
export type IStorageOptions = {
  /**
   * Custom implementation of the flag configuration store for advanced use-cases.
   */
  flagConfigurationStore?: IConfigurationStore<Flag>;

  /**
   * A custom class to use for storing flag configurations.
   * This is useful for cases where you want to use a different storage mechanism
   * than the default storage provided by the SDK.
   */
  persistentStore?: IAsyncStore<Flag>;
};

/**
 * Configure periodic loading of the Eppo configration from the API server.
 */
export type IPollingOptions = {
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
};

/**
 * Loggers used by the Eppo Client when assignment are made (and bandit actions are selected).
 */
export type ILoggers = {
  /**
   * Pass a logging implementation to send variation assignments to your data warehouse.
   */
  assignmentLogger: IAssignmentLogger;

  /**
   * Pass a logging implementation to send bandit assignments to your data warehouse.
   */
  banditLogger?: IBanditLogger;
};

/**
 * Options for backwards compatibility.
 */
export type ICompatibilityOptions = {
  /**
   * Force reinitialize the SDK if it is already initialized.
   * @deprecated use `buildAndInit` to create a fresh client.
   */
  forceReinitialize?: boolean;
};

export type OverridesConfig = {
  /**
   * Enable the Overrides Store for local flag overrides.
   * (default: false)
   */
  enableOverrides?: boolean;

  /**
   * The key to use for the overrides store.
   */
  overridesStorageKey?: string;
};

/**
 * Configuration for regular client initialization
 * Create your initialization options object as one large object:
 *
 * const options {
 *   apiKey = 'MY SDK KEY',
 *   assignmentLogger,
 *   maxCacheAgeSeconds = 30,
 * }
 *
 * OR, build separate objects for your config and destructure them at call to `init`.
 *
 * const apiOptions: IApiOptions = { apiKey = 'MY SDK KEY'};
 * const loggerOptions: ILoggerOptions = {assignmentLogger, banditLogger};
 * const eventOptions: IEventOptions = { ... };
 *
 * const eppoClient = init({...apiOptions, ...loggerOptions, ...eventOptions});
 *
 * @public
 */
export type IClientConfig = IApiOptions &
  ILoggers &
  IEventOptions &
  IStorageOptions &
  IPollingOptions &
  OverridesConfig;
