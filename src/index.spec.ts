/**
 * @jest-environment jsdom
 */

import { createHash } from 'crypto';

import {
  applicationLogger,
  AssignmentCache,
  constants,
  EppoClient,
  Flag,
  HybridConfigurationStore,
  IAssignmentEvent,
  IAsyncStore,
  IPrecomputedConfigurationResponse,
  VariationType,
} from '@eppo/js-client-sdk-common';
import * as td from 'testdouble';

import {
  getTestAssignments,
  IAssignmentTestCase,
  MOCK_PRECOMPUTED_WIRE_FILE,
  MOCK_UFC_RESPONSE_FILE,
  OBFUSCATED_MOCK_UFC_RESPONSE_FILE,
  readAssignmentTestData,
  readMockPrecomputedResponse,
  readMockUfcResponse,
  validateTestAssignments,
} from '../test/testHelpers';

import {
  IApiOptions,
  IClientConfig,
  IClientOptions,
  IPollingOptions,
  IStorageOptions,
} from './i-client-config';
import { ServingStoreUpdateStrategy } from './isolatable-hybrid.store';

import {
  EppoJSClient,
  EppoPrecomputedJSClient,
  getConfigUrl,
  getInstance,
  getPrecomputedInstance,
  IAssignmentLogger,
  init,
  offlineInit,
  offlinePrecomputedInit,
  precomputedInit,
} from './index';

const { DEFAULT_POLL_INTERVAL_MS, POLL_JITTER_PCT } = constants;

function md5Hash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}

// Configuration for a single flag within the UFC.
const apiKey = 'zCsQuoHJxVPp895.ZWg9MTIzNDU2LmUudGVzdGluZy5lcHBvLmNsb3Vk';
const baseUrl = 'http://127.0.0.1:4000';

const flagKey = 'mock-experiment';
const obfuscatedFlagKey = md5Hash(flagKey);

const allocationKey = 'traffic-split';
const obfuscatedAllocationKey = base64Encode(allocationKey);

const mockNotObfuscatedFlagConfig: Flag = {
  key: flagKey,
  enabled: true,
  variationType: VariationType.STRING,
  variations: {
    ['control']: {
      key: 'control',
      value: 'control',
    },
    ['variant-1']: {
      key: 'variant-1',
      value: 'variant-1',
    },
    ['variant-2']: {
      key: 'variant-2',
      value: 'variant-2',
    },
  },
  allocations: [
    {
      key: obfuscatedAllocationKey,
      rules: [],
      splits: [
        {
          variationKey: 'control',
          shards: [
            {
              salt: 'some-salt',
              ranges: [{ start: 0, end: 3400 }],
            },
          ],
        },
        {
          variationKey: 'variant-1',
          shards: [
            {
              salt: 'some-salt',
              ranges: [{ start: 3400, end: 6700 }],
            },
          ],
        },
        {
          variationKey: 'variant-2',
          shards: [
            {
              salt: 'some-salt',
              ranges: [{ start: 6700, end: 10000 }],
            },
          ],
        },
      ],
      doLog: true,
    },
  ],
  totalShards: 10000,
};

const mockObfuscatedUfcFlagConfig: Flag = {
  key: obfuscatedFlagKey,
  enabled: true,
  variationType: VariationType.STRING,
  variations: {
    [base64Encode('control')]: {
      key: base64Encode('control'),
      value: base64Encode('control'),
    },
    [base64Encode('variant-1')]: {
      key: base64Encode('variant-1'),
      value: base64Encode('variant-1'),
    },
    [base64Encode('variant-2')]: {
      key: base64Encode('variant-2'),
      value: base64Encode('variant-2'),
    },
    [base64Encode('variant-3')]: {
      key: base64Encode('variant-3'),
      value: base64Encode('variant-3'),
    },
  },
  allocations: [
    {
      key: obfuscatedAllocationKey,
      rules: [],
      splits: [
        {
          variationKey: base64Encode('control'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 0, end: 3400 }],
            },
          ],
        },
        {
          variationKey: base64Encode('variant-1'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 3400, end: 6700 }],
            },
          ],
        },
        {
          variationKey: base64Encode('variant-2'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 6700, end: 10000 }],
            },
          ],
        },
      ],
      doLog: true,
    },
  ],
  totalShards: 10000,
};

describe('EppoJSClient E2E test', () => {
  let globalClient: EppoClient;
  let mockLogger: IAssignmentLogger;

  beforeAll(async () => {
    global.fetch = jest.fn(() => {
      const ufc = readMockUfcResponse(MOCK_UFC_RESPONSE_FILE);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ufc),
      });
    }) as jest.Mock;

    mockLogger = td.object<IAssignmentLogger>();

    globalClient = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      forceReinitialize: true,
    });
  });

  beforeEach(() => {
    // We want each test to start with an empty local storage
    // Note: mock localStorage is provided by jest
    window.localStorage.clear();
  });

  afterEach(() => {
    globalClient.setAssignmentLogger(mockLogger);
    td.reset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns default value when experiment config is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    td.replace(HybridConfigurationStore.prototype, 'get', () => null as null);
    const assignment = globalClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
    expect(assignment).toEqual('default-value');
  });

  it('logs variation assignment and experiment key', () => {
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }

      return mockObfuscatedUfcFlagConfig;
    });

    const mockAssignmentCache = td.object<AssignmentCache>();
    td.when(mockAssignmentCache.has(td.matchers.anything())).thenReturn(false);
    td.when(mockAssignmentCache.set(td.matchers.anything())).thenReturn();
    globalClient.useCustomAssignmentCache(mockAssignmentCache);

    const mockLogger = td.object<IAssignmentLogger>();
    globalClient.setAssignmentLogger(mockLogger);

    const subjectAttributes = { foo: 3 };
    const assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      subjectAttributes,
      'default-value',
    );

    expect(assignment).toEqual('variant-1');
    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(1);
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0].subject).toEqual('subject-10');
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0].featureFlag).toEqual(flagKey);
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0].experiment).toEqual(
      `${flagKey}-${allocationKey}`,
    );
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0].allocation).toEqual(
      `${allocationKey}`,
    );
  });

  it('handles logging exception', () => {
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockLogger.logAssignment(td.matchers.anything())).thenThrow(new Error('logging error'));
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return mockObfuscatedUfcFlagConfig;
    });
    const subjectAttributes = { foo: 3 };
    globalClient.setAssignmentLogger(mockLogger);
    const assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      subjectAttributes,
      'default-value',
    );
    expect(assignment).toEqual('variant-1');
  });

  it('only returns variation if subject matches rules', () => {
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }

      // Modified flag with a single rule.
      return {
        ...mockObfuscatedUfcFlagConfig,
        allocations: [
          {
            ...mockObfuscatedUfcFlagConfig.allocations[0],
            rules: [
              {
                conditions: [
                  {
                    attribute: md5Hash('appVersion'),
                    operator: md5Hash('GT'),
                    value: base64Encode('10'),
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    let assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      { appVersion: 9 },
      'default-value',
    );
    expect(assignment).toEqual('default-value');
    assignment = globalClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
    expect(assignment).toEqual('default-value');
    assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      { appVersion: 11 },
      'default-value',
    );
    expect(assignment).toEqual('variant-1');
  });

  describe('UFC Obfuscated Test Cases', () => {
    beforeAll(async () => {
      global.fetch = jest.fn(() => {
        const ufc = readMockUfcResponse(OBFUSCATED_MOCK_UFC_RESPONSE_FILE);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(ufc),
        });
      }) as jest.Mock;

      globalClient = await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        forceReinitialize: true,
      });
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it.each(readAssignmentTestData())(
      'test variation assignment splits',
      async ({ flag, variationType, defaultValue, subjects }: IAssignmentTestCase) => {
        const client = getInstance();

        const typeAssignmentFunctions = {
          [VariationType.BOOLEAN]: client.getBooleanAssignment.bind(client),
          [VariationType.NUMERIC]: client.getNumericAssignment.bind(client),
          [VariationType.INTEGER]: client.getIntegerAssignment.bind(client),
          [VariationType.STRING]: client.getStringAssignment.bind(client),
          [VariationType.JSON]: client.getJSONAssignment.bind(client),
        };

        const assignmentFn = typeAssignmentFunctions[variationType];
        if (!assignmentFn) {
          throw new Error(`Unknown variation type: ${variationType}`);
        }

        const assignments = getTestAssignments(
          { flag, variationType, defaultValue, subjects },
          assignmentFn,
          true,
        );

        validateTestAssignments(assignments, flag);
      },
    );
  });
});

describe('decoupled initialization', () => {
  let mockLogger: IAssignmentLogger;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let init: (config: IClientConfig) => Promise<EppoJSClient>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let getInstance: () => EppoJSClient;

  beforeEach(async () => {
    jest.isolateModules(() => {
      // Isolate and re-require so that the static instance is reset to its default state
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const reloadedModule = require('./index');
      init = reloadedModule.init;
      getInstance = reloadedModule.getInstance;
    });
  });

  describe('isolated from the singleton', () => {
    beforeEach(() => {
      mockLogger = td.object<IAssignmentLogger>();

      global.fetch = jest.fn(() => {
        const ufc = { flags: { [obfuscatedFlagKey]: mockObfuscatedUfcFlagConfig } };

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(ufc),
        });
      }) as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should be independent of the singleton', async () => {
      const apiOptions: IApiOptions = { sdkKey: '<MY SDK KEY>' };
      const options: IClientOptions = { ...apiOptions, assignmentLogger: mockLogger };
      const isolatedClient = new EppoJSClient(options);

      expect(isolatedClient).not.toEqual(getInstance());
      await isolatedClient.waitForReady();

      expect(isolatedClient.isInitialized()).toBe(true);
      expect(isolatedClient.initialized).toBe(true);
      expect(getInstance().isInitialized()).toBe(false);
      expect(getInstance().initialized).toBe(false);

      expect(getInstance().getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'default-value',
      );
      expect(
        isolatedClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value'),
      ).toEqual('variant-1');
    });
    it('initializes on instantiation and notifies when ready', async () => {
      const apiOptions: IApiOptions = { sdkKey: '<MY SDK KEY>', baseUrl };
      const options: IClientOptions = { ...apiOptions, assignmentLogger: mockLogger };
      const client = new EppoJSClient(options);

      expect(client.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'default-value',
      );

      await client.waitForReady();

      const assignment = client.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
      expect(assignment).toEqual('variant-1');
    });
  });

  describe('multiple client instances', () => {
    const API_KEY_1 = 'my-api-key-1';
    const API_KEY_2 = 'my-api-key-2';
    const API_KEY_3 = 'my-api-key-3';

    const commonOptions: Omit<IClientOptions, 'sdkKey'> = {
      baseUrl,
      assignmentLogger: mockLogger,
    };

    let callCount = 0;

    beforeAll(() => {
      global.fetch = jest.fn((url: string) => {
        callCount++;

        const urlParams = new URLSearchParams(url.split('?')[1]);

        // Get the value of the apiKey parameter and serve a specific variant.
        const apiKey = urlParams.get('apiKey');

        // differentiate between the SDK keys by changing the variant that `flagKey` assigns.
        let variant = 'variant-1';
        if (apiKey === API_KEY_2) {
          variant = 'variant-2';
        } else if (apiKey === API_KEY_3) {
          variant = 'variant-3';
        }

        const encodedVariant = base64Encode(variant);

        // deep copy the mock data since we're going to inject a change below.
        const flagConfig: Flag = JSON.parse(JSON.stringify(mockObfuscatedUfcFlagConfig));
        // Inject the encoded variant as a single split for the flag's only allocation.
        flagConfig.allocations[0].splits = [
          {
            variationKey: encodedVariant,
            shards: [],
          },
        ];

        const ufc = { flags: { [obfuscatedFlagKey]: flagConfig } };

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(ufc),
        });
      }) as jest.Mock;
    });
    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should operate in parallel', async () => {
      const singleton = await init({ ...commonOptions, apiKey: API_KEY_1 });
      expect(singleton.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-1',
      );
      expect(callCount).toBe(1);

      const myClient2 = new EppoJSClient({ ...commonOptions, sdkKey: API_KEY_2 });
      await myClient2.waitForReady();
      expect(callCount).toBe(2);

      expect(singleton.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-1',
      );
      expect(myClient2.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-2',
      );

      const myClient3 = new EppoJSClient({ ...commonOptions, sdkKey: API_KEY_3 });
      await myClient3.waitForReady();

      expect(singleton.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-1',
      );
      expect(myClient2.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-2',
      );

      expect(myClient3.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
        'variant-3',
      );
    });
  });
});

describe('sync init', () => {
  it('initializes with flags in obfuscated mode', () => {
    const client = offlineInit({
      isObfuscated: true,
      flagsConfiguration: {
        [obfuscatedFlagKey]: mockObfuscatedUfcFlagConfig,
      },
    });

    expect(client.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
      'variant-1',
    );
  });

  it('initializes with flags in not-obfuscated mode', () => {
    const client = offlineInit({
      isObfuscated: false,
      flagsConfiguration: {
        [flagKey]: mockNotObfuscatedFlagConfig,
      },
    });

    expect(client.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toEqual(
      'variant-1',
    );
  });
});

describe('initialization options', () => {
  let mockLogger: IAssignmentLogger;
  let returnUfc = readMockUfcResponse; // function so it can be overridden per-test

  const maxRetryDelay = DEFAULT_POLL_INTERVAL_MS * POLL_JITTER_PCT;
  const mockConfigResponse = {
    flags: {
      [obfuscatedFlagKey]: mockObfuscatedUfcFlagConfig,
    },
  } as unknown as Record<'flags', Record<string, Flag>>;

  // eslint-disable-next-line @typescript-eslint/ban-types
  let init: (config: IClientConfig) => Promise<EppoJSClient>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let getInstance: () => EppoJSClient;

  beforeEach(async () => {
    jest.isolateModules(() => {
      // Isolate and re-require so that the static instance is reset to it's default state
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const reloadedModule = require('./index');
      init = reloadedModule.init;
      getInstance = reloadedModule.getInstance;
    });

    global.fetch = jest.fn(() => Promise.reject('Each test case should mock fetch'));

    mockLogger = td.object<IAssignmentLogger>();

    jest.useFakeTimers({
      advanceTimers: true,
      doNotFake: [
        'Date',
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
      ],
    });

    // We want each test to have an empty local storage
    // Note: mock localStorage is provided by jest
    window.localStorage.clear();
  });

  afterEach(() => {
    td.reset();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('default options', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      if (++callCount === 1) {
        throw new Error('Intentional Thrown Error For Test');
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockConfigResponse),
        });
      }
    }) as jest.Mock;

    // By not awaiting (yet) only the first attempt should be fired off before test execution below resumes
    const initPromise = init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });

    // Advance timers mid-init to allow retrying
    await jest.advanceTimersByTimeAsync(maxRetryDelay);

    // Await so it can finish its initialization before this test proceeds
    const client = await initPromise;
    expect(callCount).toBe(2);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // By default, no more calls
    await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS * 10);
    expect(callCount).toBe(2);
  });

  it('only fetches/does initialization workload once if init is called multiple times concurrently', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      ++callCount;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    const inits: Promise<EppoClient>[] = [];
    [...Array(10).keys()].forEach(() => {
      inits.push(
        init({
          apiKey,
          baseUrl,
          assignmentLogger: mockLogger,
        }),
      );
    });

    // Advance timers mid-init to allow retrying
    await jest.advanceTimersByTimeAsync(maxRetryDelay);

    // Await for all the initialization calls to resolve
    const client = await Promise.race(inits);
    await Promise.all(inits);

    expect(callCount).toBe(1);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
  });

  it('only fetches/does initialization workload once per API key if init is called multiple times concurrently', async () => {
    // IMPORTANT NOTE
    // Initializing the SDK with multiple different SDK Keys is undefined behaviour as the EppoClient is accessed via
    // `getInstance` which returns a singleton. Initializing with multiple keys is _not yet supported_, so in this test,
    // we just use the same key over and over. The more intricate parts of configuration loading and storing will
    // silently break and fail the tests in unexpected ways if we use multiple keys.

    let callCount = 0;

    global.fetch = jest.fn(() => {
      ++callCount;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    const inits: Promise<EppoClient>[] = [];
    [
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
      'KEY_1',
    ].forEach((varyingAPIKey) => {
      inits.push(
        init({
          apiKey: varyingAPIKey,
          baseUrl,
          forceReinitialize: true,
          assignmentLogger: mockLogger,
        }),
      );
    });

    // Advance timers mid-init to allow retrying
    await jest.advanceTimersByTimeAsync(maxRetryDelay);

    // Await for all the initialization calls to resolve
    const client = await Promise.race(inits);
    await Promise.all(inits);

    expect(callCount).toBe(1);
    callCount = 0;
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    const reInits: Promise<EppoClient>[] = [];
    ['KEY_1', 'KEY_1', 'KEY_1', 'KEY_1'].forEach((varyingAPIKey) => {
      reInits.push(
        init({
          apiKey: varyingAPIKey,
          forceReinitialize: true,
          baseUrl,
          assignmentLogger: mockLogger,
        }),
      );
    });

    await Promise.all(reInits);

    expect(callCount).toBe(1);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
  });

  it('do not reinitialize if already initialized', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      callCount += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });

    await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });

    expect(callCount).toBe(1);
  });

  it('force reinitialize', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      callCount += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });

    await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      forceReinitialize: true,
    });

    expect(callCount).toBe(2);
  });

  it('polls after successful init if configured to do so', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      callCount += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    // By not awaiting (yet) only the first attempt should be fired off before test execution below resumes
    const client = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      pollAfterSuccessfulInitialization: true,
    });
    expect(callCount).toBe(1);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // Advance timers mid-init to allow retrying
    await jest.advanceTimersByTimeAsync(maxRetryDelay);

    // Should be polling
    await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS * 10);
    expect(callCount).toBe(11);
  });

  it('gives up initial request and throws error after hitting max retries', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      callCount += 1;
      throw new Error('Intentional Thrown Error For Test');
    }) as jest.Mock;

    // Note: fake time does not play well with errors bubbled up after setTimeout (event loop,
    // timeout queue, message queue stuff) so we don't allow retries when rethrowing.
    await expect(
      init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        numInitialRequestRetries: 0,
      }),
    ).rejects.toThrow();

    expect(callCount).toBe(1);

    // Assignments resolve to default.
    const client = getInstance();
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
      'default-value',
    );

    // Expect no further configuration requests
    await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS);
    expect(callCount).toBe(1);
  });

  it('gives up initial request but still polls later if configured to do so', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      if (++callCount <= 2) {
        throw new Error('Intentional Thrown Error For Test');
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    // By not awaiting (yet) only the first attempt should be fired off before test execution below resumes
    const initPromise = init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      throwOnFailedInitialization: false,
      pollAfterFailedInitialization: true,
    });

    // Advance timers mid-init to allow retrying
    await jest.advanceTimersByTimeAsync(maxRetryDelay);

    // Initialization configured to not throw error
    const client = await initPromise;
    expect(callCount).toBe(2);

    // Initial assignments resolve to be the default
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
      'default-value',
    );

    await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS);

    // Expect a new call from poller
    expect(callCount).toBe(3);

    // Assignments now working
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
  });

  // This test sets up the EppoClient to fail to load a configuration.
  // If init is told to skip the initial request and there is no persistent store with data,
  // the client throws an error (unless throwOnFailedInitialization = false).
  it('skips initial request', async () => {
    let callCount = 0;

    global.fetch = jest.fn(() => {
      callCount += 1;

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    await init({
      apiKey,
      baseUrl,
      throwOnFailedInitialization: false,
      assignmentLogger: mockLogger,
      skipInitialRequest: true,
    });
    expect(callCount).toBe(0);
  });

  test.each([false, true])(
    'Wait or not for fetch when cache is expired - %s',
    async (useExpiredCache) => {
      let updatedStoreEntries: Record<string, Flag> | null = null;
      const mockStore: IAsyncStore<Flag> = {
        isInitialized() {
          return true;
        },
        async isExpired() {
          return true;
        },
        async entries() {
          return {
            'old-key': mockObfuscatedUfcFlagConfig,
          };
        },
        async setEntries(entries) {
          updatedStoreEntries = entries;
        },
      };

      // TODO: use jest to mock fetch so it can be restored
      const fetchDelayMs = 500;
      let fetchResolved = false;
      global.fetch = jest.fn(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            fetchResolved = true;
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(mockConfigResponse),
            });
          }, fetchDelayMs);
        });
      }) as jest.Mock;

      let initComplete = false;
      init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        persistentStore: mockStore,
        useExpiredCache,
      })
        .then((client) => {
          initComplete = true;
          return client;
        })
        .catch((err) => {
          throw err;
        });

      await jest.advanceTimersByTimeAsync(250);

      expect(fetchResolved).toBe(false);
      expect(updatedStoreEntries).toBeNull();

      if (useExpiredCache) {
        expect(initComplete).toBe(true);
      } else {
        expect(initComplete).toBe(false);
      }

      await jest.advanceTimersByTimeAsync(250);
      expect(fetchResolved).toBe(true);
      expect(updatedStoreEntries).toBe(mockConfigResponse.flags);
      expect(initComplete).toBe(true);
    },
  );

  it('Uses its cache', async () => {
    // Mock fetch so first call works, second fails
    let fetchCallCount = 0;
    let fetchResolveCount = 0;
    const fetchResolveDelayMs = 500;
    global.fetch = jest.fn(() => {
      if (++fetchCallCount === 1) {
        fetchResolveCount += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockConfigResponse),
        });
      } else {
        // WAIT 200 ms and then reject
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            fetchResolveCount += 1;
            reject('Intentional failed fetch error for test');
          }, fetchResolveDelayMs);
        });
      }
    }) as jest.Mock;

    // First initialization will have nothing cached, will need fetch to resolve to populate it
    let client = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      forceReinitialize: true,
    });

    expect(fetchCallCount).toBe(1);
    expect(fetchResolveCount).toBe(1);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // Init again where we know cache will succeed and fetch will fail
    client = await init({
      apiKey,
      baseUrl: 'https://thisisabaddomainforthistest.com',
      assignmentLogger: mockLogger,
      useExpiredCache: true,
      forceReinitialize: true,
    });

    // Should serve assignment from cache before fetch even fails
    expect(fetchCallCount).toBe(2);
    expect(fetchResolveCount).toBe(1);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // Should not be tripped up by failed fetch
    await jest.advanceTimersByTimeAsync(fetchResolveDelayMs);
    expect(fetchResolveCount).toBe(2);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // Different API key uses different cache (will throw because of empty cache and failed fetch)
    await expect(
      init({
        apiKey: 'another api key',
        baseUrl: 'https://thisisabaddomainforthistest.com',
        assignmentLogger: mockLogger,
        useExpiredCache: true,
        forceReinitialize: true,
      }),
    ).rejects.toThrow();
  });

  it('Ignores cache if fetch finishes first', async () => {
    // Mock fetch so first call works, second fails
    let fetchCallCount = 0;
    global.fetch = jest.fn(() => {
      fetchCallCount += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockConfigResponse),
      });
    }) as jest.Mock;

    let storeLoaded = false;
    const mockStoreDelayMs = 500;
    let mockStoreEntries = { 'bad-flags': {} } as unknown as Record<string, Flag>;

    const mockStore: IAsyncStore<Flag> = {
      isInitialized() {
        return true;
      },
      async isExpired() {
        return true; // triggers a fetch
      },
      async entries() {
        return new Promise((resolve) => {
          setTimeout(() => {
            storeLoaded = true;
            resolve(mockStoreEntries);
          }, mockStoreDelayMs);
        });
      },
      async setEntries(entries) {
        mockStoreEntries = entries;
      },
    };

    // Init with our mock store
    const client = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      persistentStore: mockStore,
    });

    // init should complete with fetch
    expect(fetchCallCount).toBe(1);
    expect(storeLoaded).toBe(false);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');

    // Store loading should not overwrite fetch result
    await jest.advanceTimersByTimeAsync(mockStoreDelayMs);
    expect(fetchCallCount).toBe(1);
    expect(storeLoaded).toBe(true);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
    // store entries should reflect latest fetch
    expect(mockStoreEntries).toEqual(mockConfigResponse.flags);
  });

  test.each(['always', 'expired', 'empty'] as ServingStoreUpdateStrategy[])(
    'Fetch updates cache according to the "%s" update strategy',
    async (updateOnFetch: ServingStoreUpdateStrategy) => {
      // Mock fetch so first call works immediately, and all others takes time
      // Also mock fetch so that it alternates the config it returns each time
      let fetchResolveCount = 0;
      let fetchCallCount = 0;
      const fetchResolveDelayMs = 500;

      const flagKey1 = 'flagKey1';
      const flagKey2 = 'flagKey2';

      global.fetch = jest.fn(() => {
        const delayMs = ++fetchCallCount === 1 ? 0 : fetchResolveDelayMs;
        const flagKey = fetchCallCount % 2 === 1 ? flagKey1 : flagKey2;
        return new Promise((resolve) => {
          setTimeout(() => {
            fetchResolveCount += 1;
            resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  flags: {
                    [md5Hash(flagKey)]: mockObfuscatedUfcFlagConfig,
                  },
                }),
            });
          }, delayMs);
        });
      }) as jest.Mock;

      // First initialization will have nothing cached, will need fetch to resolve
      let client = await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        updateOnFetch,
        forceReinitialize: true,
      });

      expect(fetchCallCount).toBe(1);
      expect(fetchResolveCount).toBe(1);
      expect(client.getStringAssignment(flagKey1, 'subject', {}, 'default-value')).toBe('control');
      expect(client.getStringAssignment(flagKey2, 'subject', {}, 'default-value')).toBe(
        'default-value',
      );

      // Init again with an expired cache so a fetch will kicked off too
      // We allow the expired cache, so it will succeed and fetch will be delayed
      client = await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        updateOnFetch,
        useExpiredCache: true,
        forceReinitialize: true,
      });

      // Should serve assignment from cache before fetch completes
      expect(fetchCallCount).toBe(2);
      expect(fetchResolveCount).toBe(1);
      expect(client.getStringAssignment(flagKey1, 'subject', {}, 'default-value')).toBe('control');
      expect(client.getStringAssignment(flagKey2, 'subject', {}, 'default-value')).toBe(
        'default-value',
      );

      // Completed fetch will now result in updated assignments unless set not to update a previously
      // populated serving store
      await jest.advanceTimersByTimeAsync(fetchResolveDelayMs);
      expect(fetchCallCount).toBe(2);
      expect(fetchResolveCount).toBe(2);
      expect(client.getStringAssignment(flagKey1, 'subject', {}, 'default-value')).toBe(
        updateOnFetch === 'empty' ? 'control' : 'default-value',
      );
      expect(client.getStringAssignment(flagKey2, 'subject', {}, 'default-value')).toBe(
        updateOnFetch === 'empty' ? 'default-value' : 'control',
      );

      // Init from updated cache, with allowable cache age
      client = await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        updateOnFetch,
        maxCacheAgeSeconds: fetchResolveDelayMs * 10,
        forceReinitialize: true,
      });

      // No fetch will have been kicked off because of valid cache; previously fetched values will be served
      expect(fetchCallCount).toBe(2);
      expect(fetchResolveCount).toBe(2);
      expect(client.getStringAssignment(flagKey1, 'subject', {}, 'default-value')).toBe(
        'default-value',
      );
      expect(client.getStringAssignment(flagKey2, 'subject', {}, 'default-value')).toBe('control');
    },
  );

  describe('With reloaded index module', () => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    let init: Function;
    // eslint-disable-next-line @typescript-eslint/ban-types
    let getInstance: Function;
    beforeEach(async () => {
      jest.isolateModules(() => {
        // Isolate and re-require so that the static instance is reset to it's default state
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const reloadedModule = require('./index');
        init = reloadedModule.init;
        getInstance = reloadedModule.getInstance;
      });

      global.fetch = jest.fn(() => {
        const ufc = returnUfc(MOCK_UFC_RESPONSE_FILE);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(ufc),
        });
      }) as jest.Mock;

      mockLogger = td.object<IAssignmentLogger>();

      await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        forceReinitialize: true,
      });
    });

    it('returns empty assignments pre-initialization by default', async () => {
      returnUfc = () => mockConfigResponse;
      expect(getInstance().getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toBe(
        'default-value',
      );
      // don't await
      init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        forceReinitialize: true,
      });
      expect(getInstance().getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
        'default-value',
      );
      // Advance time so a poll happened and check again
      await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS);
      expect(getInstance().getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
        'control',
      );
    });
  });

  describe('advanced initialization conditions', () => {
    it('skips the fetch and uses the persistent store when unexpired', async () => {
      // This test sets up a case where the persistent store has unexpired entries, but fails to load them into memory
      // before the fetching code checks to see whether the entries are expired. In this case, the fetch can abort but
      // we want the initialization routine to now wait for the config to finish loading.
      const entriesPromise = new DeferredPromise<Record<string, Flag>>();

      const mockStore: IAsyncStore<Flag> = {
        isInitialized() {
          return false; // mock that entries have not been save from a fetch.
        },
        async isExpired() {
          return false; // prevents a fetch
        },
        async entries() {
          return entriesPromise.promise;
        },
        async setEntries(entries) {
          // pass
        },
      };

      let callCount = 0;
      const mockStoreEntries = { flags: {} } as unknown as Record<string, Flag>;
      global.fetch = jest.fn(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ flags: mockStoreEntries }),
        });
      }) as jest.Mock;

      const mockLogger = td.object<IAssignmentLogger>();
      let clientInitialized = false;
      const initPromise = init({
        apiKey,
        baseUrl,
        persistentStore: mockStore,
        forceReinitialize: true,
        assignmentLogger: mockLogger,
      }).then((client) => {
        clientInitialized = true;
        return client;
      });

      expect(callCount).toBe(0);
      expect(clientInitialized).toBe(false);

      // Complete the "load from cache"
      if (entriesPromise.resolve) {
        entriesPromise.resolve(mockConfigResponse.flags);
      } else {
        throw 'Error running test';
      }

      // Await so it can finish its initialization before this test proceeds
      const client = await initPromise;
      expect(callCount).toBe(0);
      expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
    });
  });
});

describe('getConfigUrl function', () => {
  const apiKey = 'abcd1234';
  const defaultBaseUrl = 'https://fscdn.eppo.cloud/api';
  const customBaseUrl = 'http://api.example.com';

  it('should return a URL using the default base URL when no base URL is provided', () => {
    const url = getConfigUrl(apiKey);
    expect(url.toString()).toContain(defaultBaseUrl);
    expect(url.toString()).not.toContain(customBaseUrl);
    expect(url.toString()).toContain(`apiKey=${apiKey}`);
    expect(url.toString()).toContain('sdkName=');
    expect(url.toString()).toContain('sdkVersion=');
  });

  it('should return a URL using the provided base URL', () => {
    const url = getConfigUrl(apiKey, customBaseUrl);
    expect(url.toString()).toContain(customBaseUrl);
    expect(url.toString()).not.toContain(defaultBaseUrl);
    expect(url.toString()).toContain(`apiKey=${apiKey}`);
    expect(url.toString()).toContain('sdkName=');
    expect(url.toString()).toContain('sdkVersion=');
  });
});

describe('EppoPrecomputedJSClient E2E test', () => {
  let globalClient: EppoPrecomputedJSClient;
  let mockLogger: IAssignmentLogger;

  beforeAll(async () => {
    global.fetch = jest.fn(() => {
      const precomputedConfiguration = readMockPrecomputedResponse(MOCK_PRECOMPUTED_WIRE_FILE);
      const precomputedResponse: IPrecomputedConfigurationResponse = JSON.parse(
        JSON.parse(precomputedConfiguration).precomputed.response,
      );
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(precomputedResponse),
      });
    }) as jest.Mock;

    mockLogger = td.object<IAssignmentLogger>();

    globalClient = await precomputedInit({
      apiKey: 'dummy',
      baseUrl: 'http://127.0.0.1:4000',
      assignmentLogger: mockLogger,
      precompute: {
        subjectKey: 'test-subject',
        subjectAttributes: { attr1: 'value1' },
      },
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns correct assignments for different value types', () => {
    expect(globalClient.getStringAssignment('string-flag', 'default')).toBe('red');
    expect(globalClient.getBooleanAssignment('boolean-flag', false)).toBe(true);
    expect(globalClient.getNumericAssignment('numeric-flag', 0)).toBe(3.14);
    expect(globalClient.getIntegerAssignment('integer-flag', 0)).toBe(42);
    expect(globalClient.getJSONAssignment('json-flag', {})).toEqual({
      key: 'value',
      number: 123,
    });
  });

  it('logs assignments correctly', () => {
    // Reset the mock logger before this test
    mockLogger = td.object<IAssignmentLogger>();
    globalClient.setAssignmentLogger(mockLogger);
    globalClient.getStringAssignment('string-flag', 'default');

    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(1);
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0]).toMatchObject({
      subject: 'test-subject',
      featureFlag: 'string-flag',
      allocation: 'allocation-123',
      variation: 'variation-123',
      subjectAttributes: { attr1: 'value1' },
      format: 'PRECOMPUTED',
    });

    // Test that multiple assignments are logged
    globalClient.getBooleanAssignment('boolean-flag', false);

    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(2);
    expect(td.explain(mockLogger.logAssignment).calls[1]?.args[0]).toMatchObject({
      subject: 'test-subject',
      featureFlag: 'boolean-flag',
      allocation: 'allocation-124',
      variation: 'variation-124',
      subjectAttributes: { attr1: 'value1' },
      format: 'PRECOMPUTED',
    });
  });
});

describe('offlinePrecomputedInit', () => {
  let mockLogger: IAssignmentLogger;
  let precomputedConfiguration: string;

  beforeAll(() => {
    precomputedConfiguration = readMockPrecomputedResponse(MOCK_PRECOMPUTED_WIRE_FILE);
  });

  beforeEach(() => {
    mockLogger = td.object<IAssignmentLogger>();
  });

  afterEach(() => {
    td.reset();
  });

  it('initializes with precomputed assignments', () => {
    const client = offlinePrecomputedInit({
      precomputedConfiguration,
      assignmentLogger: mockLogger,
    });

    expect(client.getStringAssignment('string-flag', 'default')).toBe('red');
    expect(td.explain(mockLogger.logAssignment).callCount).toBe(1);
    expect(td.explain(mockLogger.logAssignment).calls[0]?.args[0]).toMatchObject({
      subject: 'test-subject-key',
      featureFlag: 'string-flag',
      allocation: 'allocation-123',
      variation: 'variation-123',
      subjectAttributes: {
        buildNumber: 42,
        hasPushEnabled: false,
        language: 'en-US',
        lastLoginDays: 3,
        lifetimeValue: 543.21,
        platform: 'ios',
      },
    });
  });

  describe('getPrecomputedInstance', () => {
    it('returns an instance that safely returns defaults without logging', () => {
      const mockLogger = td.object<IAssignmentLogger>();
      const instance = getPrecomputedInstance();
      instance.setAssignmentLogger(mockLogger);

      const result = instance.getStringAssignment('any-flag', 'default-value');

      expect(result).toBe('default-value');
      td.verify(mockLogger.logAssignment(td.matchers.anything()), { times: 0 });
    });
  });

  it('initializes without an assignment logger', () => {
    const client = offlinePrecomputedInit({ precomputedConfiguration });

    expect(client.getStringAssignment('string-flag', 'default')).toBe('red');
  });

  it('logs a warning on re-initialization', () => {
    td.replace(applicationLogger, 'warn');
    EppoPrecomputedJSClient.initialized = false;
    // First initialization there is no client to spy on, so we only test that no warning is logged
    offlinePrecomputedInit({
      precomputedConfiguration,
      assignmentLogger: mockLogger,
    });
    td.verify(
      applicationLogger.warn(td.matchers.contains('Precomputed client is being re-initialized.')),
      { times: 0 },
    );
    // Replace instance with a mock and check that shutdown is called on re-initialization
    const mockInstance = td.object<EppoPrecomputedJSClient>();
    EppoPrecomputedJSClient.instance = mockInstance;
    offlinePrecomputedInit({
      precomputedConfiguration,
      assignmentLogger: mockLogger,
    });
    td.verify(mockInstance.stopPolling(), { times: 1 });
    td.verify(
      applicationLogger.warn(td.matchers.contains('Precomputed client is being re-initialized.')),
      { times: 1 },
    );
  });
});

describe('EppoClient config', () => {
  it('should initialize event dispatcher with default values', async () => {
    global.fetch = jest.fn(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ flags: {} }),
      });
    }) as jest.Mock;
    const client = await init({
      forceReinitialize: true,
      apiKey: 'zCsQuoHJxVPp895.ZWg9MTIzNDU2LmUudGVzdGluZy5lcHBvLmNsb3Vk',
      assignmentLogger: td.object<IAssignmentLogger>(),
      eventIngestionConfig: {
        deliveryIntervalMs: 1,
        retryIntervalMs: 2,
        maxRetryDelayMs: 3,
        maxRetries: 4,
        batchSize: 500,
      },
    });
    // hack to read the private class members config
    const eventDispatcher = client['eventDispatcher'];
    const retryManager = eventDispatcher['retryManager'];
    const batchProcessor = eventDispatcher['batchProcessor'];
    expect(eventDispatcher['deliveryIntervalMs']).toEqual(1);
    expect(batchProcessor['batchSize']).toEqual(500);
    expect(retryManager['config']['retryIntervalMs']).toEqual(2);
    expect(retryManager['config']['maxRetryDelayMs']).toEqual(3);
    expect(retryManager['config']['maxRetries']).toEqual(4);
  });

  it('handles empty precomputed configuration string', () => {
    // Test with throwOnFailedInitialization = true (default)
    expect(() =>
      offlinePrecomputedInit({
        precomputedConfiguration: '',
      }),
    ).toThrow('Invalid precomputed configuration wire');

    // Test with throwOnFailedInitialization = false
    td.replace(applicationLogger, 'error');
    const client = offlinePrecomputedInit({
      precomputedConfiguration: '',
      throwOnFailedInitialization: false,
    });

    expect(client).toBe(EppoPrecomputedJSClient.instance);
    td.verify(applicationLogger.error('[Eppo SDK] Invalid precomputed configuration wire'), {
      times: 1,
    });
  });
});

/**
 * A wrapper for a promise which allows for later resolution.
 */
class DeferredPromise<T> {
  promise: Promise<T>;
  resolve?: (value: PromiseLike<T> | T) => void;
  reject?: (reason?: never) => void;
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.promise = new Promise<T>((resolve, reject) => {
      self.resolve = resolve;
      self.reject = reject;
    });
  }
}
