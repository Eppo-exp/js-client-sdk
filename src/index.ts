import {
  IAssignmentLogger,
  validation,
  EppoClient,
  FlagConfigurationRequestParameters,
  Flag,
  IAsyncStore,
  AttributeType,
  ObfuscatedFlag,
  ApiEndpoints,
  applicationLogger,
  IAssignmentDetails,
  BanditActions,
  BanditSubjectAttributes,
  IContainerExperiment,
} from '@eppo/js-client-sdk-common';

import { assignmentCacheFactory } from './cache/assignment-cache-factory';
import HybridAssignmentCache from './cache/hybrid-assignment-cache';
import {
  chromeStorageIfAvailable,
  configurationStorageFactory,
  hasChromeStorage,
  hasWindowLocalStorage,
  localStorageIfAvailable,
} from './configuration-factory';
import { ServingStoreUpdateStrategy } from './isolatable-hybrid.store';
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

export interface IClientConfigSync {
  flagsConfiguration: Record<string, Flag | ObfuscatedFlag>;

  assignmentLogger?: IAssignmentLogger;

  isObfuscated?: boolean;

  throwOnFailedInitialization?: boolean;
}

// Export the common types and classes from the SDK.
export {
  IAssignmentDetails,
  IAssignmentEvent,
  IAssignmentLogger,
  IAsyncStore,
  Flag,
  ObfuscatedFlag,
} from '@eppo/js-client-sdk-common';
export { ChromeStorageEngine } from './chrome-storage-engine';

// Instantiate the configuration store with memory-only implementation.
const flagConfigurationStore = configurationStorageFactory({
  forceMemoryOnly: true,
});

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  // Ensure that the client is instantiated during class loading.
  // Use an empty memory-only configuration store until the `init` method is called,
  // to avoid serving stale data to the user.
  public static instance: EppoJSClient = new EppoJSClient(
    flagConfigurationStore,
    undefined,
    undefined,
    undefined,
    true,
  );
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

  public getStringAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: string,
  ): IAssignmentDetails<string> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getStringAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  /**
   * @deprecated Use getBooleanAssignment instead
   */
  public getBoolAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: boolean,
  ): boolean {
    return this.getBooleanAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBooleanAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: boolean,
  ): boolean {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBooleanAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBooleanAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: boolean,
  ): IAssignmentDetails<boolean> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBooleanAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
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

  public getIntegerAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): IAssignmentDetails<number> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getIntegerAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
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

  public getNumericAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): IAssignmentDetails<number> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getNumericAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
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

  public getJSONAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: object,
  ): IAssignmentDetails<object> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getJSONAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBanditAction(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: BanditSubjectAttributes,
    actions: BanditActions,
    defaultValue: string,
  ): Omit<IAssignmentDetails<string>, 'evaluationDetails'> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBanditAction(flagKey, subjectKey, subjectAttributes, actions, defaultValue);
  }

  public getBanditActionDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: BanditSubjectAttributes,
    actions: BanditActions,
    defaultValue: string,
  ): IAssignmentDetails<string> {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBanditActionDetails(
      flagKey,
      subjectKey,
      subjectAttributes,
      actions,
      defaultValue,
    );
  }

  public getExperimentContainerEntry<T>(
    flagExperiment: IContainerExperiment<T>,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
  ): T {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getExperimentContainerEntry(flagExperiment, subjectKey, subjectAttributes);
  }

  private static getAssignmentInitializationCheck() {
    if (!EppoJSClient.initialized) {
      applicationLogger.warn('Eppo SDK assignment requested before init() completed');
    }
  }
}

export function buildStorageKeySuffix(apiKey: string): string {
  // Note that we use the first 8 characters of the API key to create per-API key persistent storages and caches
  return apiKey.replace(/\W/g, '').substring(0, 8);
}

/**
 * Initializes the Eppo client with configuration parameters.
 *
 * The purpose is for use-cases where the configuration is available from an external process
 * that can bootstrap the SDK.
 *
 * This method should be called once on application startup.
 *
 * @param config - client configuration
 * @returns a singleton client instance
 * @public
 */
export function offlineInit(config: IClientConfigSync): EppoClient {
  const isObfuscated = config.isObfuscated ?? false;
  const throwOnFailedInitialization = config.throwOnFailedInitialization ?? true;

  try {
    const memoryOnlyConfigurationStore = configurationStorageFactory({
      forceMemoryOnly: true,
    });
    memoryOnlyConfigurationStore
      .setEntries(config.flagsConfiguration)
      .catch((err) =>
        applicationLogger.warn('Error setting flags for memory-only configuration store', err),
      );
    EppoJSClient.instance.setFlagConfigurationStore(memoryOnlyConfigurationStore);

    // Allow the caller to override the default obfuscated mode, which is false
    // since the purpose of this method is to bootstrap the SDK from an external source,
    // which is likely a server that has not-obfuscated flag values.
    EppoJSClient.instance.setIsObfuscated(isObfuscated);

    if (config.assignmentLogger) {
      EppoJSClient.instance.setAssignmentLogger(config.assignmentLogger);
    }

    // There is no SDK key in the offline context.
    const storageKeySuffix = 'offline';

    // As this is a synchronous initialization,
    // we are unable to call the async `init` method on the assignment cache
    // which loads the assignment cache from the browser's storage.
    // Therefore, there is no purpose trying to use a persistent assignment cache.
    const assignmentCache = assignmentCacheFactory({
      storageKeySuffix,
      forceMemoryOnly: true,
    });
    EppoJSClient.instance.useCustomAssignmentCache(assignmentCache);
  } catch (error) {
    applicationLogger.warn(
      'Eppo SDK encountered an error initializing, assignment calls will return the default value and not be logged',
    );
    if (throwOnFailedInitialization) {
      throw error;
    }
  }

  EppoJSClient.initialized = true;
  return EppoJSClient.instance;
}

/**
 * Initializes the Eppo client with configuration parameters.
 * This method should be called once on application startup.
 * @param config - client configuration
 * @public
 */
export async function init(config: IClientConfig): Promise<EppoClient> {
  validation.validateNotBlank(config.apiKey, 'API key required');
  let initializationError: Error | undefined;
  const instance = EppoJSClient.instance;
  const {
    apiKey,
    persistentStore,
    baseUrl,
    maxCacheAgeSeconds,
    updateOnFetch,
    forceReinitialize,
    requestTimeoutMs,
    numInitialRequestRetries,
    numPollRequestRetries,
    pollingIntervalMs,
    pollAfterSuccessfulInitialization = false,
    pollAfterFailedInitialization = false,
    skipInitialRequest = false,
  } = config;
  try {
    if (EppoJSClient.initialized) {
      if (forceReinitialize) {
        applicationLogger.warn(
          'Eppo SDK is already initialized, reinitializing since forceReinitialize is true.',
        );
        EppoJSClient.initialized = false;
      } else {
        applicationLogger.warn(
          'Eppo SDK is already initialized, skipping reinitialization since forceReinitialize is false.',
        );
        return instance;
      }
    }

    // If any existing instances; ensure they are not polling
    instance.stopPolling();
    // Set up assignment logger and cache
    instance.setAssignmentLogger(config.assignmentLogger);
    // Default to obfuscated mode when requesting configuration from the server.
    instance.setIsObfuscated(true);

    const storageKeySuffix = buildStorageKeySuffix(apiKey);

    // Set the configuration store to the desired persistent store, if provided.
    // Otherwise, the factory method will detect the current environment and instantiate the correct store.
    const configurationStore = configurationStorageFactory(
      {
        maxAgeSeconds: maxCacheAgeSeconds,
        servingStoreUpdateStrategy: updateOnFetch,
        persistentStore,
        hasChromeStorage: hasChromeStorage(),
        hasWindowLocalStorage: hasWindowLocalStorage(),
      },
      {
        chromeStorage: chromeStorageIfAvailable(),
        windowLocalStorage: localStorageIfAvailable(),
        storageKeySuffix,
      },
    );
    instance.setFlagConfigurationStore(configurationStore);

    // instantiate and init assignment cache
    const assignmentCache = assignmentCacheFactory({
      chromeStorage: chromeStorageIfAvailable(),
      storageKeySuffix,
    });
    if (assignmentCache instanceof HybridAssignmentCache) {
      await assignmentCache.init();
    }
    instance.useCustomAssignmentCache(assignmentCache);

    // Set up parameters for requesting updated configurations
    const requestConfiguration: FlagConfigurationRequestParameters = {
      apiKey,
      sdkName,
      sdkVersion,
      baseUrl,
      requestTimeoutMs,
      numInitialRequestRetries,
      numPollRequestRetries,
      pollAfterSuccessfulInitialization,
      pollAfterFailedInitialization,
      pollingIntervalMs,
      throwOnFailedInitialization: true, // always use true here as underlying instance fetch is surrounded by try/catch
      skipInitialPoll: skipInitialRequest,
    };
    instance.setConfigurationRequestParameters(requestConfiguration);

    // We have two at-bats for initialization: from the configuration store and from fetching
    // We can resolve the initialization promise as soon as either one succeeds
    let initFromConfigStoreError = undefined;
    let initFromFetchError = undefined;

    const attemptInitFromConfigStore = configurationStore
      .init()
      .then(async () => {
        if (!configurationStore.getKeys().length) {
          // Consider empty configuration stores invalid
          applicationLogger.warn('Eppo SDK cached configuration is empty');
          initFromConfigStoreError = new Error('Configuration store was empty');
          return '';
        }

        const cacheIsExpired = await configurationStore.isExpired();
        if (cacheIsExpired && !config.useExpiredCache) {
          applicationLogger.warn('Eppo SDK set not to use expired cached configuration');
          initFromConfigStoreError = new Error('Configuration store was expired');
          return '';
        }
        return 'config store';
      })
      .catch((e) => {
        applicationLogger.warn(
          'Eppo SDK encountered an error initializing from the configuration store',
          e,
        );
        initFromConfigStoreError = e;
      });
    const attemptInitFromFetch = instance
      .fetchFlagConfigurations()
      .then(() => {
        return 'fetch';
      })
      .catch((e) => {
        applicationLogger.warn('Eppo SDK encountered an error initializing from fetching', e);
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
  } catch (error: any) {
    initializationError = error;
  }

  if (initializationError) {
    applicationLogger.warn(
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
  return instance;
}

/**
 * Used to access a singleton SDK client instance.
 * Use the method after calling init() to initialize the client.
 * @returns a singleton client instance
 * @public
 */
export function getInstance(): EppoClient {
  return EppoJSClient.instance;
}

/**
 * Used to build the URL for fetching the flag configuration.
 * @returns a URL string
 * @public
 */
export function getConfigUrl(apiKey: string, baseUrl?: string): URL {
  const queryParams = { sdkName, sdkVersion, apiKey };
  return new ApiEndpoints({ baseUrl, queryParams }).ufcEndpoint();
}
