import {
  IAssignmentLogger,
  validation,
  IEppoClient,
  EppoClient,
  FlagConfigurationRequestParameters,
} from '@eppo/js-client-sdk-common';

import { EppoLocalStorage } from './local-storage';
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
}

export { IAssignmentLogger, IAssignmentEvent, IEppoClient } from '@eppo/js-client-sdk-common';

const localStorage = new EppoLocalStorage();

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  public static instance: EppoJSClient = new EppoJSClient(localStorage);
  public static initialized = false;

  public getStringAssignment(
    subjectKey: string,
    flagKey: string,
    defaultValue: string,
    subjectAttributes?: Record<string, any>,
  ): string {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getStringAssignment(subjectKey, flagKey, defaultValue, subjectAttributes);
  }

  public getBoolAssignment(
    subjectKey: string,
    flagKey: string,
    defaultValue: boolean,
    subjectAttributes?: Record<string, any>,
  ): boolean {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBoolAssignment(subjectKey, flagKey, defaultValue, subjectAttributes);
  }

  public getIntegerAssignment(
    subjectKey: string,
    flagKey: string,
    defaultValue: number,
    subjectAttributes?: Record<string, any>,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getIntegerAssignment(subjectKey, flagKey, defaultValue, subjectAttributes);
  }

  public getNumericAssignment(
    subjectKey: string,
    flagKey: string,
    defaultValue: number,
    subjectAttributes?: Record<string, any>,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getNumericAssignment(subjectKey, flagKey, defaultValue, subjectAttributes);
  }

  public getJSONAssignment(
    subjectKey: string,
    flagKey: string,
    defaultValue: object,
    subjectAttributes?: Record<string, any>,
  ): object {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getJSONAssignment(subjectKey, flagKey, defaultValue, subjectAttributes);
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
  try {
    // If any existing instances; ensure they are not polling
    if (EppoJSClient.instance) {
      EppoJSClient.instance.stopPolling();
    }

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
    };

    EppoJSClient.instance.setLogger(config.assignmentLogger);

    // default behavior is to use a LocalStorage-based assignment cache.
    // this can be overridden after initialization.
    EppoJSClient.instance.useCustomAssignmentCache(new LocalStorageAssignmentCache());
    EppoJSClient.instance.setConfigurationRequestParameters(requestConfiguration);
    await EppoJSClient.instance.fetchFlagConfigurations();
  } catch (error) {
    console.warn(
      'Eppo SDK encountered an error initializing, assignment calls will return the default value and not be logged' +
        (config.pollAfterFailedInitialization
          ? ' until an experiment configuration is successfully retrieved'
          : ''),
    );
    if (config.throwOnFailedInitialization ?? true) {
      throw error;
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
