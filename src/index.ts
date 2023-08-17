import {
  IAssignmentLogger,
  validation,
  constants,
  ExperimentConfigurationRequestor,
  IEppoClient,
  EppoClient,
  HttpClient,
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
}

export { IAssignmentLogger, IAssignmentEvent, IEppoClient } from '@eppo/js-client-sdk-common';

const localStorage = new EppoLocalStorage();

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  public static instance: EppoJSClient = new EppoJSClient(localStorage);
}

/**
 * Initializes the Eppo client with configuration parameters.
 * This method should be called once on application startup.
 * @param config client configuration
 * @public
 */
export async function init(config: IClientConfig): Promise<IEppoClient> {
  validation.validateNotBlank(config.apiKey, 'API key required');
  const axiosInstance = axios.create({
    baseURL: config.baseUrl || constants.BASE_URL,
    timeout: constants.REQUEST_TIMEOUT_MILLIS,
  });
  const httpClient = new HttpClient(axiosInstance, {
    apiKey: config.apiKey,
    sdkName,
    sdkVersion,
  });
  EppoJSClient.instance.setLogger(config.assignmentLogger);
  const configurationRequestor = new ExperimentConfigurationRequestor(localStorage, httpClient);
  await configurationRequestor.fetchAndStoreConfigurations();
  return EppoJSClient.instance;
}

/**
 * Used to access a singleton SDK client instance.
 * Use the method after calling init() to initialize the client.
 * @returns a singleton client instance
 */
export function getInstance(): IEppoClient {
  return EppoJSClient.instance;
}
