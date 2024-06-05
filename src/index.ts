import {
  IAssignmentLogger,
  validation,
  IEppoClient,
  EppoClient,
  FlagConfigurationRequestParameters,
  Flag,
  IAsyncStore,
  AttributeType,
} from '@eppo/js-client-sdk-common';

import {
  configurationStorageFactory,
  hasChromeStorage,
  hasWindowLocalStorage,
} from './configuration-factory';
import { ServingStoreUpdateStrategy } from './isolated-hybrid.store';
import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';
import { sdkName, sdkVersion } from './sdk-data';

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
   * Poll for new configurations (every 30 seconds) after successfully requesting the initial configuration. (default: false)
   */
  pollAfterSuccessfulInitialization?: boolean;

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
}

// Export the common types and classes from the SDK.
export {
  IAssignmentLogger,
  IAssignmentEvent,
  IEppoClient,
  IAsyncStore,
} from '@eppo/js-client-sdk-common';
export { ChromeStorageAsyncStore } from './chrome-storage.store';

// Instantiate the configuration store with memory-only implementation.
const configurationStore = configurationStorageFactory({ forceMemoryOnly: true });

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  // Ensure that the client is instantiated during class loading.
  // Use an empty memory-only configuration store until the `init` method is called,
  // to avoid serving stale data to the user.
  public static instance: EppoJSClient = new EppoJSClient(configurationStore, undefined, true);
  public static initialized = false;

  public getStringAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: string,
  ): string {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getStringAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBoolAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: boolean,
  ): boolean {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBoolAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getIntegerAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getIntegerAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getNumericAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getNumericAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getJSONAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: object,
  ): object {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getJSONAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  private static getAssignmentInitializationCheck() {
    if (!EppoJSClient.initialized) {
      console.warn('Eppo SDK assignment requested before init() completed');
    }
  }
}

/**
 * Initializes the Eppo client with configuration parameters.
 * This method should be called once on application startup.
 * @param config - client configuration
 * @public
 */
export async function init(config: IClientConfig): Promise<IEppoClient> {
  validation.validateNotBlank(config.apiKey, 'API key required');
  let initializationError: Error | undefined;
  try {
    // If any existing instances; ensure they are not polling
    EppoJSClient.instance.stopPolling();
    // Set up assignment logger and cache
    EppoJSClient.instance.setLogger(config.assignmentLogger);
    // default behavior is to use a LocalStorage-based assignment cache.
    // this can be overridden after initialization.
    EppoJSClient.instance.useCustomAssignmentCache(new LocalStorageAssignmentCache());

    // Set the configuration store to the desired persistent store, if provided.
    // Otherwise, the factory method will detect the current environment and instantiate the correct store.
    const configurationStore = configurationStorageFactory(
      {
        maxAgeSeconds: config.maxCacheAgeSeconds,
        servingStoreUpdateStrategy: config.updateOnFetch,
        persistentStore: config.persistentStore,
        hasChromeStorage: hasChromeStorage(),
        hasWindowLocalStorage: hasWindowLocalStorage(),
      },
      {
        chromeStorage: hasChromeStorage() ? chrome.storage.local : undefined,
        windowLocalStorage: hasWindowLocalStorage() ? window.localStorage : undefined,
      },
    );
    EppoJSClient.instance.setConfigurationStore(configurationStore);

    // Set up parameters for requesting updated configurations
    const requestConfiguration: FlagConfigurationRequestParameters = {
      apiKey: config.apiKey,
      sdkName,
      sdkVersion,
      baseUrl: config.baseUrl ?? undefined,
      requestTimeoutMs: config.requestTimeoutMs ?? undefined,
      numInitialRequestRetries: config.numInitialRequestRetries ?? undefined,
      numPollRequestRetries: config.numPollRequestRetries ?? undefined,
      pollAfterSuccessfulInitialization: config.pollAfterSuccessfulInitialization ?? false,
      pollAfterFailedInitialization: config.pollAfterFailedInitialization ?? false,
      throwOnFailedInitialization: true, // always use true here as underlying instance fetch is surrounded by try/catch
      skipInitialPoll: config.skipInitialRequest ?? false,
    };
    EppoJSClient.instance.setConfigurationRequestParameters(requestConfiguration);

    // We have two at-bats for initialization: from the configuration store and from fetching
    // We can resolve the initialization promise as soon as either one succeeds
    let initFromConfigStoreError = undefined;
    let initFromFetchError = undefined;

    const attemptInitFromConfigStore = configurationStore
      .init()
      .then(async () => {
        if (!configurationStore.getKeys().length) {
          // Consider empty configuration stores invalid
          console.warn('Eppo SDK cached configuration is empty');
          initFromConfigStoreError = new Error('Configuration store was empty');
          return '';
        }

        const cacheIsExpired = await configurationStore.isExpired();
        if (cacheIsExpired && !config.useExpiredCache) {
          console.warn('Eppo SDK set not to use expired cached configuration');
          initFromConfigStoreError = new Error('Configuration store was expired');
          return '';
        }
        return 'config store';
      })
      .catch((e) => {
        console.warn('Eppo SDK encountered an error initializing from the configuration store', e);
        initFromConfigStoreError = e;
      });
    const attemptInitFromFetch = EppoJSClient.instance
      .fetchFlagConfigurations()
      .then(() => {
        return 'fetch';
      })
      .catch((e) => {
        console.warn('Eppo SDK encountered an error initializing from fetching', e);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        initFromFetchError = e;
      });

    let initializationSource = await Promise.race([
      attemptInitFromConfigStore,
      attemptInitFromFetch,
    ]);

    if (!initializationSource) {
      // First attempt failed, but we have a second at bat that will be executed in the scope of the top-level try-catch
      if (!initFromConfigStoreError) {
        initializationSource = await attemptInitFromConfigStore;
      } else {
        initializationSource = await attemptInitFromFetch;
      }
    }

    if (!initializationSource) {
      // both failed, make the "fatal" error the fetch one
      initializationError = initFromFetchError;
    }
  } catch (error) {
    initializationError = error;
  }

  if (initializationError) {
    console.warn(
      'Eppo SDK was unable to initialize with a configuration, assignment calls will return the default value and not be logged' +
        (config.pollAfterFailedInitialization
          ? ' until an experiment configuration is successfully retrieved'
          : ''),
    );
    if (config.throwOnFailedInitialization ?? true) {
      throw initializationError;
    }
  }

  EppoJSClient.initialized = true;
  return EppoJSClient.instance;
}

/**
 * Used to access a singleton SDK client instance.
 * Use the method after calling init() to initialize the client.
 * @returns a singleton client instance
 * @public
 */
export function getInstance(): IEppoClient {
  return EppoJSClient.instance;
}
