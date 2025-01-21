/**
 * Enumerate the kinds of results we can get from a configuration loading source.
 */
export enum ConfigLoaderStatus {
  FAILED, // An error was encountered
  DID_NOT_PRODUCE, // There was no error encountered, but other logic resulted in no useful configuration from this source
  COMPLETED, // Useful configuration was successfully loaded into the configuration store from this source.
}

export enum ConfigSource {
  CONFIG_STORE,
  FETCH,
  NONE,
}

export type ConfigurationLoadAttempt = Promise<[ConfigSource, ConfigLoaderStatus]>;
