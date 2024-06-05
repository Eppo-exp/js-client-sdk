export interface IStorageEngine {
  getConfigurationJsonString: () => Promise<string | null>;
  getMetaConfigurationJsonString: () => Promise<string | null>;
  setConfigurationJsonString: (configurationJsonString: string) => Promise<void>;
  setMetaJsonString: (metaJsonString: string) => Promise<void>;
}
