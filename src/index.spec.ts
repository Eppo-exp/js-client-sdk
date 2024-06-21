/**
 * @jest-environment jsdom
 */

import { createHash } from 'crypto';

import {
  Flag,
  VariationType,
  constants,
  HybridConfigurationStore,
  IAsyncStore,
} from '@eppo/js-client-sdk-common';
import * as td from 'testdouble';

const { POLL_INTERVAL_MS, POLL_JITTER_PCT } = constants;

import {
  IAssignmentTestCase,
  readAssignmentTestData,
  readMockUfcResponse,
  MOCK_UFC_RESPONSE_FILE,
  OBFUSCATED_MOCK_UFC_RESPONSE_FILE,
  getTestAssignments,
  validateTestAssignments,
} from '../test/testHelpers';

import { ServingStoreUpdateStrategy } from './isolatable-hybrid.store';

import {
  offlineInit,
  IAssignmentLogger,
  IEppoClient,
  getInstance,
  init,
  IClientConfig,
  getConfigUrl,
} from './index';

function md5Hash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}

// Configuration for a single flag within the UFC.
const apiKey = 'dummy';
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
  let globalClient: IEppoClient;
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
    });
  });

  beforeEach(() => {
    // We want each test to start with an empty local storage
    // Note: mock localStorage is provided by jest
    window.localStorage.clear();
  });

  afterEach(() => {
    globalClient.setLogger(mockLogger);
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

    const subjectAttributes = { foo: 3 };
    globalClient.setLogger(mockLogger);
    const assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      subjectAttributes,
      'default-value',
    );

    expect(assignment).toEqual('variant-1');
    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(1);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].subject).toEqual('subject-10');
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].featureFlag).toEqual(flagKey);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].experiment).toEqual(
      `${flagKey}-${allocationKey}`,
    );
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].allocation).toEqual(
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
    globalClient.setLogger(mockLogger);
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
          [VariationType.BOOLEAN]: client.getBoolAssignment.bind(client),
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

  const maxRetryDelay = POLL_INTERVAL_MS * POLL_JITTER_PCT;
  const mockConfigResponse = {
    flags: {
      [obfuscatedFlagKey]: mockObfuscatedUfcFlagConfig,
    },
  } as unknown as Record<'flags', Record<string, Flag>>;

  // eslint-disable-next-line @typescript-eslint/ban-types
  let init: (config: IClientConfig) => Promise<IEppoClient>;
  // eslint-disable-next-line @typescript-eslint/ban-types
  let getInstance: () => IEppoClient;

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
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
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
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
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
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
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

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // Expect a new call from poller
    expect(callCount).toBe(3);

    // Assignments now working
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
  });

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
      assignmentLogger: mockLogger,
      skipInitialRequest: true,
    });
    expect(callCount).toBe(0);
  });

  test.each([false, true])(
    'Wait or not for fetch when cache is expired - %s',
    async (useExpiredCache) => {
      let updatedStoreEntries = null;
      const mockStore: IAsyncStore<Flag> = {
        isInitialized() {
          return true;
        },
        async isExpired() {
          return true;
        },
        async getEntries() {
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
      async getEntries() {
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

  test.each(['always', 'expired', 'empty'])(
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
      });
      expect(getInstance().getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
        'default-value',
      );
      // Advance time so a poll happened and check again
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(getInstance().getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
        'control',
      );
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
