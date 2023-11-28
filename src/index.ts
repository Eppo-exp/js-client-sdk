import {
  IAssignmentLogger,
  validation,
  constants,
  ExperimentConfigurationRequestor,
  IEppoClient,
  EppoClient,
  HttpClient,
  IAssignmentHooks,
} from '@eppo/js-client-sdk-common';
import axios from 'axios';

import { EppoLocalStorage } from './local-storage';
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
}

export { IAssignmentLogger, IAssignmentEvent, IEppoClient } from '@eppo/js-client-sdk-common';

const localStorage = new EppoLocalStorage();

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  public static instance: EppoJSClient = new EppoJSClient(localStorage);

  public getAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): string | null {
    return super.getAssignment(subjectKey, flagKey, subjectAttributes, assignmentHooks, true);
  }

  public getStringAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): string | null {
    return super.getStringAssignment(subjectKey, flagKey, subjectAttributes, assignmentHooks, true);
  }

  public getBoolAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): boolean | null {
    return super.getBoolAssignment(subjectKey, flagKey, subjectAttributes, assignmentHooks, true);
  }

  public getNumericAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): number | null {
    return super.getNumericAssignment(
      subjectKey,
      flagKey,
      subjectAttributes,
      assignmentHooks,
      true,
    );
  }

  public getJSONStringAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): string | null {
    return super.getJSONStringAssignment(
      subjectKey,
      flagKey,
      subjectAttributes,
      assignmentHooks,
      true,
    );
  }

  public getParsedJSONAssignment(
    subjectKey: string,
    flagKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subjectAttributes?: Record<string, any>,
    assignmentHooks?: IAssignmentHooks,
  ): object | null {
    return super.getParsedJSONAssignment(
      subjectKey,
      flagKey,
      subjectAttributes,
      assignmentHooks,
      true,
    );
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
    const axiosInstance = axios.create({
      baseURL: config.baseUrl || constants.BASE_URL,
      timeout: config.requestTimeoutMs || constants.REQUEST_TIMEOUT_MILLIS,
    });
    const httpClient = new HttpClient(axiosInstance, {
      apiKey: config.apiKey,
      sdkName,
      sdkVersion,
    });
    EppoJSClient.instance.setLogger(config.assignmentLogger);

    // default behavior is to use a non-expiring cache.
    // this can be overridden after initialization.
    EppoJSClient.instance.useNonExpiringAssignmentCache();

    const configurationRequestor = new ExperimentConfigurationRequestor(localStorage, httpClient);
    await configurationRequestor.fetchAndStoreConfigurations();
  } catch (error) {
    console.warn('Error encountered initializing Eppo SDK, assignment calls will return null and not be logged');
    throw error;
  }
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
