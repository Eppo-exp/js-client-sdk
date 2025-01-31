import {
  IConfigurationStore,
  ObfuscatedFlag,
  Flag,
  EventDispatcher,
} from '@eppo/js-client-sdk-common';
import * as td from 'testdouble';

import { clientOptionsToEppoClientParameters } from './client-options-converter';
import { IClientOptions } from './i-client-config';
import { sdkName, sdkVersion } from './sdk-data';

describe('clientOptionsToParameters', () => {
  const mockStore = td.object<IConfigurationStore<Flag | ObfuscatedFlag>>();

  it('converts basic client options', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      baseUrl: 'https://test.eppo.cloud',
      assignmentLogger: { logAssignment: jest.fn() },
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.isObfuscated).toBe(true);
    expect(result.flagConfigurationStore).toBeDefined();
    expect(result.configurationRequestParameters).toEqual({
      apiKey: 'test-key',
      baseUrl: 'https://test.eppo.cloud',
      sdkName,
      sdkVersion,
      numInitialRequestRetries: undefined,
      numPollRequestRetries: undefined,
      pollingIntervalMs: undefined,
      requestTimeoutMs: undefined,
      pollAfterFailedInitialization: undefined,
      pollAfterSuccessfulInitialization: undefined,
      throwOnFailedInitialization: undefined,
      skipInitialPoll: undefined,
    });
  });

  it('uses provided flag configuration store', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.flagConfigurationStore).toBe(mockStore);
  });

  it('converts client options with event ingestion config', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
    };
    const mockDispatcher: EventDispatcher = td.object<EventDispatcher>();

    const result = clientOptionsToEppoClientParameters(options, mockStore, mockDispatcher);

    expect(result.eventDispatcher).toBeDefined();
  });

  it('converts client options with polling configuration', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
      pollingIntervalMs: 30000,
      pollAfterSuccessfulInitialization: true,
      pollAfterFailedInitialization: true,
      skipInitialRequest: true,
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.configurationRequestParameters).toMatchObject({
      pollingIntervalMs: 30000,
      pollAfterSuccessfulInitialization: true,
      pollAfterFailedInitialization: true,
      skipInitialPoll: true,
    });
  });

  it('converts client options with retry configuration', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
      requestTimeoutMs: 5000,
      numInitialRequestRetries: 3,
      numPollRequestRetries: 2,
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.configurationRequestParameters).toMatchObject({
      requestTimeoutMs: 5000,
      numInitialRequestRetries: 3,
      numPollRequestRetries: 2,
    });
  });

  it('handles undefined optional parameters', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.configurationRequestParameters).toMatchObject({
      baseUrl: undefined,
      pollingIntervalMs: undefined,
      requestTimeoutMs: undefined,
      numInitialRequestRetries: undefined,
      numPollRequestRetries: undefined,
    });
  });

  it('includes sdk metadata', () => {
    const options: IClientOptions = {
      sdkKey: 'test-key',
      assignmentLogger: { logAssignment: jest.fn() },
    };

    const result = clientOptionsToEppoClientParameters(options, mockStore);

    expect(result.configurationRequestParameters).toMatchObject({
      sdkName,
      sdkVersion,
    });
  });
});
