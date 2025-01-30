import {
  BanditParameters,
  BanditVariation,
  EventDispatcher,
  Flag,
  FlagConfigurationRequestParameters,
  IConfigurationStore,
  ObfuscatedFlag,
} from '@eppo/js-client-sdk-common';

import { IClientOptions } from './i-client-config';
import { sdkName, sdkVersion } from './sdk-data';

export type EppoClientParameters = {
  // Dispatcher for arbitrary, application-level events (not to be confused with Eppo specific assignment
  // or bandit events). These events are application-specific and captures by EppoClient#track API.
  eventDispatcher?: EventDispatcher;
  flagConfigurationStore: IConfigurationStore<Flag | ObfuscatedFlag>;
  banditVariationConfigurationStore?: IConfigurationStore<BanditVariation[]>;
  banditModelConfigurationStore?: IConfigurationStore<BanditParameters>;
  configurationRequestParameters?: FlagConfigurationRequestParameters;
  isObfuscated?: boolean;
};

/**
 * Converts IClientOptions to EppoClientParameters
 * @internal
 */
export function clientOptionsToParameters(
  options: IClientOptions,
  flagConfigurationStore: IConfigurationStore<Flag>,
  eventDispatcher?: EventDispatcher,
): EppoClientParameters {
  const parameters: EppoClientParameters = {
    flagConfigurationStore,
    isObfuscated: true,
  };

  parameters.eventDispatcher = eventDispatcher;

  // Always include configuration request parameters
  parameters.configurationRequestParameters = {
    apiKey: options.sdkKey,
    sdkVersion, // dynamically picks up version.
    sdkName, // Hardcoded to `js-client-sdk`
    baseUrl: options.baseUrl,
    requestTimeoutMs: options.requestTimeoutMs,
    numInitialRequestRetries: options.numInitialRequestRetries,
    numPollRequestRetries: options.numPollRequestRetries,
    pollAfterSuccessfulInitialization: options.pollAfterSuccessfulInitialization,
    pollAfterFailedInitialization: options.pollAfterFailedInitialization,
    pollingIntervalMs: options.pollingIntervalMs,
    throwOnFailedInitialization: options.throwOnFailedInitialization,
    skipInitialPoll: options.skipInitialRequest,
  };

  return parameters;
}
