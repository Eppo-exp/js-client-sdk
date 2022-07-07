import axios from 'axios';

import { IAssignmentLogger } from './assignment-logger';
import { BASE_URL, REQUEST_TIMEOUT_MILLIS, SESSION_ASSIGNMENT_CONFIG_LOADED } from './constants';
import EppoClient, { IEppoClient } from './eppo-client';
import ExperimentConfigurationRequestor from './experiment/experiment-configuration-requestor';
import HttpClient from './http-client';
import { EppoLocalStorage } from './local-storage';
import { sdkName, sdkVersion } from './sdk-data';
import { EppoSessionStorage } from './session-storage';
import { validateNotBlank } from './validation';

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
}

export { IAssignmentLogger, IAssignmentEvent } from './assignment-logger';
export { IEppoClient } from './eppo-client';

const localStorage = new EppoLocalStorage();
const sessionStorage = new EppoSessionStorage();

/**
 * Initializes the Eppo client with configuration parameters.
 * This method should be called once on application startup.
 * @param config client configuration
 * @public
 */
export async function init(config: IClientConfig) {
  validateNotBlank(config.apiKey, 'API key required');
  const axiosInstance = axios.create({
    baseURL: config.baseUrl || BASE_URL,
    timeout: REQUEST_TIMEOUT_MILLIS,
  });
  const httpClient = new HttpClient(axiosInstance, {
    apiKey: config.apiKey,
    sdkName,
    sdkVersion,
  });
  const configurationRequestor = new ExperimentConfigurationRequestor(localStorage, httpClient);
  if (sessionStorage.get(SESSION_ASSIGNMENT_CONFIG_LOADED) !== 'true') {
    await configurationRequestor.fetchAndStoreConfigurations();
    sessionStorage.set(SESSION_ASSIGNMENT_CONFIG_LOADED, 'true');
  }
}

/**
 * Used to access a singleton SDK client instance.
 * Use the method after calling init() to initialize the client.
 * @param assignmentLogger a logging implementation to send variation assignments to a data warehouse.
 * @returns a singleton client instance
 */
export function getInstance(assignmentLogger?: IAssignmentLogger): IEppoClient {
  return new EppoClient(localStorage, sessionStorage, assignmentLogger);
}
