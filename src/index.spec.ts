/**
 * @jest-environment jsdom
 */

import { createHash } from 'crypto';

import {
  Flag,
  VariationType,
  constants,
  HybridConfigurationStore,
} from '@eppo/js-client-sdk-common';
import * as md5 from 'md5';
import * as td from 'testdouble';
import { encode } from 'universal-base64';

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

import { IAssignmentLogger, IEppoClient, getInstance, init } from './index';

export function md5Hash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

export function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}

// Configuration for a single flag within the UFC.
const apiKey = 'dummy';
const baseUrl = 'http://127.0.0.1:4000';

const flagKey = 'mock-experiment';
const obfuscatedFlagKey = md5(flagKey);

const allocationKey = 'traffic-split';
const obfuscatedAllocationKey = base64Encode(allocationKey);

const mockUfcFlagConfig: Flag = {
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

  afterEach(() => {
    globalClient.setLogger(mockLogger);
    td.reset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns default value when experiment config is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => null as null);
    const assignment = globalClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
    expect(assignment).toEqual('default-value');
  });

  it('logs variation assignment and experiment key', () => {
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }

      return mockUfcFlagConfig;
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
      return mockUfcFlagConfig;
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
        ...mockUfcFlagConfig,
        allocations: [
          {
            ...mockUfcFlagConfig.allocations[0],
            rules: [
              {
                conditions: [
                  {
                    attribute: md5('appVersion'),
                    operator: md5('GT'),
                    value: encode('10'),
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

describe('initialization options', () => {
  let mockLogger: IAssignmentLogger;
  let returnUfc = readMockUfcResponse; // function so it can be overridden per-test

  const maxRetryDelay = POLL_INTERVAL_MS * POLL_JITTER_PCT;
  const mockConfigResponse = {
    flags: {
      [obfuscatedFlagKey]: mockUfcFlagConfig,
    },
  } as unknown as Record<'flags', Record<string, Flag>>;

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

    // We're creating a new instance for each test so we need to clear the underlying storage too
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

  describe('With reloaded index module', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    // let init: Function;
    // // eslint-disable-next-line @typescript-eslint/ban-types
    // //let getInstance: Function;
    // beforeEach(async () => {
    //   jest.isolateModules(() => {
    //     // Isolate and re-require so that the static instance is reset to it's default state
    //     // eslint-disable-next-line @typescript-eslint/no-var-requires
    //     const reloadedModule = require('./index');
    //     //init = reloadedModule.init;
    //     //getInstance = reloadedModule.getInstance;
    //   });
    // }) as jest.Mock;

    global.fetch = jest.fn(() => {
      const ufc = returnUfc(MOCK_UFC_RESPONSE_FILE);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ufc),
      });
    }) as jest.Mock;
  });

  it('returns empty assignments pre-initialization by default', async () => {
    returnUfc = () => mockConfigResponse;
    const client = getInstance();
    expect(client.getStringAssignment(flagKey, 'subject-10', {}, 'default-value')).toBe(
      'default-value',
    );
    // don't await
    init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe(
      'default-value',
    );
    // Advance time so a poll happened and check again
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(client.getStringAssignment(flagKey, 'subject', {}, 'default-value')).toBe('control');
  });
});
