import {
  ApiEndpoints,
  applicationLogger,
  AttributeType,
  BanditActions,
  BanditSubjectAttributes,
  EppoClient,
  EventDispatcher,
  Flag,
  FlagConfigurationRequestParameters,
  IAssignmentDetails,
  IAssignmentLogger,
  IContainerExperiment,
  EppoPrecomputedClient,
  PrecomputedFlagsRequestParameters,
  newDefaultEventDispatcher,
  ObfuscatedFlag,
  BoundedEventQueue,
  validation,
  PrecomputedFlag,
} from '@eppo/js-client-sdk-common';

import { assignmentCacheFactory } from './cache/assignment-cache-factory';
import HybridAssignmentCache from './cache/hybrid-assignment-cache';
import {
  chromeStorageIfAvailable,
  configurationStorageFactory,
  precomputedFlagsStorageFactory,
  hasChromeStorage,
  hasWindowLocalStorage,
  localStorageIfAvailable,
} from './configuration-factory';
import BrowserNetworkStatusListener from './events/browser-network-status-listener';
import LocalStorageBackedNamedEventQueue from './events/local-storage-backed-named-event-queue';
import { IClientConfig, IPrecomputedClientConfig } from './i-client-config';
import { sdkName, sdkVersion } from './sdk-data';

/**
 * Configuration interface for synchronous client initialization.
 * @public
 */
export interface IClientConfigSync {
  flagsConfiguration: Record<string, Flag | ObfuscatedFlag>;

  assignmentLogger?: IAssignmentLogger;

  isObfuscated?: boolean;

  throwOnFailedInitialization?: boolean;
}

export { IClientConfig, IPrecomputedClientConfig };

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

// Instantiate the precomputed flgas store with memory-only implementation.
const memoryOnlyPrecomputedFlagsStore = precomputedFlagsStorageFactory();

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  // Ensure that the client is instantiated during class loading.
  // Use an empty memory-only configuration store until the `init` method is called,
  // to avoid serving stale data to the user.
  public static instance = new EppoJSClient({
    flagConfigurationStore,
    isObfuscated: true,
  });
  public static initialized = false;

  public getStringAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: string,
  ): string {
    EppoJSClient.ensureInitialized();
    return super.getStringAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getStringAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: string,
  ): IAssignmentDetails<string> {
    EppoJSClient.ensureInitialized();
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
    EppoJSClient.ensureInitialized();
    return super.getBooleanAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBooleanAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: boolean,
  ): IAssignmentDetails<boolean> {
    EppoJSClient.ensureInitialized();
    return super.getBooleanAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getIntegerAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): number {
    EppoJSClient.ensureInitialized();
    return super.getIntegerAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getIntegerAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): IAssignmentDetails<number> {
    EppoJSClient.ensureInitialized();
    return super.getIntegerAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getNumericAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): number {
    EppoJSClient.ensureInitialized();
    return super.getNumericAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getNumericAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: number,
  ): IAssignmentDetails<number> {
    EppoJSClient.ensureInitialized();
    return super.getNumericAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getJSONAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: object,
  ): object {
    EppoJSClient.ensureInitialized();
    return super.getJSONAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getJSONAssignmentDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, AttributeType>,
    defaultValue: object,
  ): IAssignmentDetails<object> {
    EppoJSClient.ensureInitialized();
    return super.getJSONAssignmentDetails(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBanditAction(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: BanditSubjectAttributes,
    actions: BanditActions,
    defaultValue: string,
  ): Omit<IAssignmentDetails<string>, 'evaluationDetails'> {
    EppoJSClient.ensureInitialized();
    return super.getBanditAction(flagKey, subjectKey, subjectAttributes, actions, defaultValue);
  }

  public getBanditActionDetails(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: BanditSubjectAttributes,
    actions: BanditActions,
    defaultValue: string,
  ): IAssignmentDetails<string> {
    EppoJSClient.ensureInitialized();
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
    EppoJSClient.ensureInitialized();
    return super.getExperimentContainerEntry(flagExperiment, subjectKey, subjectAttributes);
  }

  private static ensureInitialized() {
    if (!EppoJSClient.initialized) {
      applicationLogger.warn('Eppo SDK assignment requested before init() completed');
    }
  }
}

/**
 * Builds a storage key suffix from an API key.
 * @param apiKey - The API key to build the suffix from
 * @returns A string suffix for storage keys
 * @public
 */
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
    instance.setEventDispatcher(newEventDispatcher(apiKey));

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
      .then(() => 'fetch')
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

/**
 * Client for assigning precomputed experiment variations.
 * @public
 */
export class EppoPrecomputedJSClient extends EppoPrecomputedClient {
  // Use an empty memory-only configuration store
  public static instance: EppoPrecomputedJSClient = new EppoPrecomputedJSClient(
    memoryOnlyPrecomputedFlagsStore,
  );
  public static initialized = false;

  public getStringAssignment(flagKey: string, defaultValue: string): string {
    EppoPrecomputedJSClient.getAssignmentInitializationCheck();
    return super.getStringAssignment(flagKey, defaultValue);
  }

  public getBooleanAssignment(flagKey: string, defaultValue: boolean): boolean {
    EppoPrecomputedJSClient.getAssignmentInitializationCheck();
    return super.getBooleanAssignment(flagKey, defaultValue);
  }

  public getIntegerAssignment(flagKey: string, defaultValue: number): number {
    EppoPrecomputedJSClient.getAssignmentInitializationCheck();
    return super.getIntegerAssignment(flagKey, defaultValue);
  }

  public getNumericAssignment(flagKey: string, defaultValue: number): number {
    EppoPrecomputedJSClient.getAssignmentInitializationCheck();
    return super.getNumericAssignment(flagKey, defaultValue);
  }

  public getJSONAssignment(flagKey: string, defaultValue: object): object {
    EppoPrecomputedJSClient.getAssignmentInitializationCheck();
    return super.getJSONAssignment(flagKey, defaultValue);
  }

  private static getAssignmentInitializationCheck() {
    if (!EppoJSClient.initialized) {
      applicationLogger.warn('Eppo SDK assignment requested before init() completed');
    }
  }
}

/**
 * Initializes the Eppo precomputed client with configuration parameters.
 * This method should be called once on application startup.
 * @param config - client configuration
 * @public
 */
export async function precomputedInit(
  config: IPrecomputedClientConfig,
): Promise<EppoPrecomputedClient> {
  validation.validateNotBlank(config.apiKey, 'API key required');
  validation.validateNotBlank(config.subjectKey, 'Subject key required');

  const instance = EppoPrecomputedJSClient.instance;
  const {
    apiKey,
    subjectKey,
    subjectAttributes = {},
    baseUrl,
    requestTimeoutMs,
    numInitialRequestRetries,
    numPollRequestRetries,
    pollingIntervalMs,
    pollAfterSuccessfulInitialization = false,
    pollAfterFailedInitialization = false,
    skipInitialRequest = false,
  } = config;

  // Set up assignment logger and cache
  instance.setAssignmentLogger(config.assignmentLogger);

  // Set up parameters for requesting updated configurations
  const precomputedFlagsRequestParameters: PrecomputedFlagsRequestParameters = {
    apiKey,
    sdkName,
    sdkVersion,
    baseUrl,
    precompute: {
      subjectKey,
      subjectAttributes,
    },
    requestTimeoutMs,
    numInitialRequestRetries,
    numPollRequestRetries,
    pollAfterSuccessfulInitialization,
    pollAfterFailedInitialization,
    pollingIntervalMs,
    throwOnFailedInitialization: true, // always use true here as underlying instance fetch is surrounded by try/catch
    skipInitialPoll: skipInitialRequest,
  };
  instance.setPrecomputedFlagsRequestParameters(precomputedFlagsRequestParameters);

  await instance.fetchPrecomputedFlags();

  EppoPrecomputedJSClient.initialized = true;
  return EppoPrecomputedJSClient.instance;
}

/**
 * Used to access a singleton SDK precomputed client instance.
 * Use the method after calling precomputedInit() to initialize the client.
 * @returns a singleton precomputed client instance
 * @public
 */
export function getPrecomputedInstance(): EppoPrecomputedClient {
  return EppoPrecomputedJSClient.instance;
}

function newEventDispatcher(sdkKey: string): EventDispatcher {
  const eventQueue = hasWindowLocalStorage()
    ? new LocalStorageBackedNamedEventQueue('events')
    : new BoundedEventQueue('events');
  const emptyNetworkStatusListener =
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    { isOffline: () => false, onNetworkStatusChange: () => {} };
  const networkStatusListener =
    typeof window !== 'undefined' ? new BrowserNetworkStatusListener() : emptyNetworkStatusListener;
  return newDefaultEventDispatcher(eventQueue, networkStatusListener, sdkKey);
}

/**
 * Initializes the Eppo precomputed client with configuration parameters.
 *
 * The purpose is for use-cases where the precomputed assignments are available from an external process
 * that can bootstrap the SDK.
 *
 * This method should be called once on application startup.
 *
 * @param config - client configuration
 * @returns a singleton precomputed client instance
 * @public
 */
export interface IPrecomputedClientConfigSync {
  precomputedAssignments: Record<string, PrecomputedFlag>;
  assignmentLogger?: IAssignmentLogger;
  throwOnFailedInitialization?: boolean;
}

export function offlinePrecomputedInit(
  config: IPrecomputedClientConfigSync,
): EppoPrecomputedClient {
  const throwOnFailedInitialization = config.throwOnFailedInitialization ?? true;

  try {
    const memoryOnlyPrecomputedStore = precomputedFlagsStorageFactory();
    memoryOnlyPrecomputedStore
      .setEntries(config.precomputedAssignments)
      .catch((err) =>
        applicationLogger.warn('Error setting precomputed assignments for memory-only store', err),
      );

    EppoPrecomputedJSClient.instance.setPrecomputedFlagStore(memoryOnlyPrecomputedStore);

    if (config.assignmentLogger) {
      EppoPrecomputedJSClient.instance.setAssignmentLogger(config.assignmentLogger);
    }
  } catch (error) {
    applicationLogger.warn(
      'Eppo SDK encountered an error initializing precomputed client, assignment calls will return the default value and not be logged',
    );
    if (throwOnFailedInitialization) {
      throw error;
    }
  }

  EppoPrecomputedJSClient.initialized = true;
  return EppoPrecomputedJSClient.instance;
}
