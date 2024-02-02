/**
 * @jest-environment jsdom
 */

import { HttpClient } from '@eppo/js-client-sdk-common';
import { POLL_INTERVAL_MS, POLL_JITTER_PCT } from '@eppo/js-client-sdk-common/dist/constants';
import { IExperimentConfiguration } from '@eppo/js-client-sdk-common/dist/dto/experiment-configuration-dto';
import { EppoValue } from '@eppo/js-client-sdk-common/dist/eppo_value';
import * as md5 from 'md5';
import * as td from 'testdouble';
import mock from 'xhr-mock';

import {
  IAssignmentTestCase,
  ValueTestType,
  readAssignmentTestData,
  readMockRacResponse,
} from '../test/testHelpers';

import { EppoLocalStorage } from './local-storage';
import { LocalStorageAssignmentCache } from './local-storage-assignment-cache';

import { IAssignmentLogger, IEppoClient, getInstance, init } from './index';

describe('EppoJSClient E2E test', () => {
  let globalClient: IEppoClient;
  let mockLogger: IAssignmentLogger;
  let returnRac = readMockRacResponse; // function so it can be overridden per-test

  const apiKey = 'dummy';
  const baseUrl = 'http://127.0.0.1:4000';
  const flagKey = 'mock-experiment';
  const hashedFlagKey = md5(flagKey);

  const mockExperimentConfig = {
    name: hashedFlagKey,
    enabled: true,
    subjectShards: 100,
    overrides: {},
    typedOverrides: {},
    rules: [
      {
        allocationKey: 'allocation1',
        conditions: [] as Array<Record<string, unknown>>,
      },
    ],
    allocations: {
      allocation1: {
        percentExposure: 1,
        variations: [
          {
            name: 'control',
            value: 'control',
            typedValue: 'control',
            shardRange: {
              start: 0,
              end: 34,
            },
          },
          {
            name: 'variant-1',
            value: 'variant-1',
            typedValue: 'variant-1',
            shardRange: {
              start: 34,
              end: 67,
            },
          },
          {
            name: 'variant-2',
            value: 'variant-2',
            typedValue: 'variant-2',
            shardRange: {
              start: 67,
              end: 100,
            },
          },
        ],
      },
    },
  };

  beforeAll(async () => {
    mock.setup();
    mock.get(/randomized_assignment\/v3\/config*/, (_req, res) => {
      const rac = returnRac();
      return res.status(200).body(JSON.stringify(rac));
    });
    mockLogger = td.object<IAssignmentLogger>();
    globalClient = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
    });
  });

  afterEach(() => {
    returnRac = readMockRacResponse;
    globalClient.setLogger(mockLogger);
    td.reset();
  });

  afterAll(() => {
    mock.teardown();
  });

  it('assigns subject from overrides when experiment is enabled', () => {
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => {
      if (key !== hashedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return {
        ...mockExperimentConfig,
        overrides: {
          '1b50f33aef8f681a13f623963da967ed': 'variant-2',
        },
        typedOverrides: {
          '1b50f33aef8f681a13f623963da967ed': 'variant-2',
        },
      };
    });

    const assignment = globalClient.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual('variant-2');
  });

  it('assigns subject from overrides when experiment is not enabled', () => {
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => {
      if (key !== hashedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return {
        ...mockExperimentConfig,
        overrides: {
          '1b50f33aef8f681a13f623963da967ed': 'variant-2',
        },
        typedOverrides: {
          '1b50f33aef8f681a13f623963da967ed': 'variant-2',
        },
      };
    });
    const assignment = globalClient.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual('variant-2');
  });

  it('returns null when experiment config is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => null as null);
    const assignment = globalClient.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual(null);
  });

  it('logs variation assignment and experiment key', () => {
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => {
      if (key !== hashedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return mockExperimentConfig;
    });

    const subjectAttributes = { foo: 3 };
    globalClient.setLogger(mockLogger);
    const assignment = globalClient.getAssignment('subject-10', flagKey, subjectAttributes);
    expect(assignment).toEqual('control');
    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(1);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].subject).toEqual('subject-10');
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].featureFlag).toEqual(flagKey);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].experiment).toEqual(
      `${flagKey}-${mockExperimentConfig?.rules[0]?.allocationKey}`,
    );
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].allocation).toEqual(
      `${mockExperimentConfig?.rules[0]?.allocationKey}`,
    );
  });

  it('handles logging exception', () => {
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockLogger.logAssignment(td.matchers.anything())).thenThrow(new Error('logging error'));
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => {
      if (key !== hashedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return mockExperimentConfig;
    });
    const subjectAttributes = { foo: 3 };
    globalClient.setLogger(mockLogger);
    const assignment = globalClient.getAssignment('subject-10', flagKey, subjectAttributes);
    expect(assignment).toEqual('control');
  });

  it('only returns variation if subject matches rules', () => {
    td.replace(EppoLocalStorage.prototype, 'get', (key: string) => {
      if (key !== hashedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return {
        ...mockExperimentConfig,
        rules: [
          {
            allocationKey: 'allocation1',
            conditions: [
              {
                operator: md5('GT'),
                attribute: md5('appVersion'),
                value: Buffer.from('10', 'utf8').toString('base64'),
              },
            ],
          },
        ],
      };
    });
    let assignment = globalClient.getAssignment('subject-10', flagKey, {
      appVersion: 9,
    });
    expect(assignment).toEqual(null);
    assignment = globalClient.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual(null);
    assignment = globalClient.getAssignment('subject-10', flagKey, {
      appVersion: 11,
    });
    expect(assignment).toEqual('control');
  });

  describe('getAssignment', () => {
    const testData = readAssignmentTestData();

    it.each(testData)(
      'test variation assignment splits',
      ({
        experiment,
        valueType = ValueTestType.StringType,
        subjects,
        subjectsWithAttributes,
        expectedAssignments,
      }: IAssignmentTestCase) => {
        console.log(`---- Test Case for ${experiment} Experiment ----`);

        const assignments = getAssignmentsWithSubjectAttributes(
          subjectsWithAttributes
            ? subjectsWithAttributes
            : subjects.map((subject) => ({ subjectKey: subject })),
          experiment,
          valueType,
        );

        switch (valueType) {
          case ValueTestType.BoolType: {
            const boolAssignments = assignments.map((a) => a?.boolValue ?? null);
            expect(boolAssignments).toEqual(expectedAssignments);
            break;
          }
          case ValueTestType.NumericType: {
            const numericAssignments = assignments.map((a) => a?.numericValue ?? null);
            expect(numericAssignments).toEqual(expectedAssignments);
            break;
          }
          case ValueTestType.StringType: {
            const stringAssignments = assignments.map((a) => a?.stringValue ?? null);
            expect(stringAssignments).toEqual(expectedAssignments);
            break;
          }
          case ValueTestType.JSONType: {
            const jsonStringAssignments = assignments.map((a) => a?.stringValue ?? null);
            expect(jsonStringAssignments).toEqual(expectedAssignments);
            break;
          }
        }
      },
    );

    it('runs expected number of test cases', () => {
      expect(testData.length).toBeGreaterThan(0);
    });
  });

  describe('LocalStorageAssignmentCache', () => {
    it('typical behavior', () => {
      const cache = new LocalStorageAssignmentCache();
      expect(
        cache.hasLoggedAssignment({
          subjectKey: 'subject-1',
          flagKey: 'flag-1',
          allocationKey: 'allocation-1',
          variationValue: EppoValue.String('control'),
        }),
      ).toEqual(false);

      cache.setLastLoggedAssignment({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationValue: EppoValue.String('control'),
      });

      expect(
        cache.hasLoggedAssignment({
          subjectKey: 'subject-1',
          flagKey: 'flag-1',
          allocationKey: 'allocation-1',
          variationValue: EppoValue.String('control'),
        }),
      ).toEqual(true); // this key has been logged

      // change variation
      cache.setLastLoggedAssignment({
        subjectKey: 'subject-1',
        flagKey: 'flag-1',
        allocationKey: 'allocation-1',
        variationValue: EppoValue.String('variant'),
      });

      expect(
        cache.hasLoggedAssignment({
          subjectKey: 'subject-1',
          flagKey: 'flag-1',
          allocationKey: 'allocation-1',
          variationValue: EppoValue.String('control'),
        }),
      ).toEqual(false); // this key has not been logged
    });
  });

  function getAssignmentsWithSubjectAttributes(
    subjectsWithAttributes: {
      subjectKey: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subjectAttributes?: Record<string, any>;
    }[],
    experiment: string,
    valueTestType: ValueTestType = ValueTestType.StringType,
  ): (EppoValue | null)[] {
    return subjectsWithAttributes.map((subject) => {
      switch (valueTestType) {
        case ValueTestType.BoolType: {
          const ba = globalClient.getBoolAssignment(
            subject.subjectKey,
            experiment,
            subject.subjectAttributes,
          );
          if (ba === null) return null;
          return EppoValue.Bool(ba);
        }
        case ValueTestType.NumericType: {
          const na = globalClient.getNumericAssignment(
            subject.subjectKey,
            experiment,
            subject.subjectAttributes,
          );
          if (na === null) return null;
          return EppoValue.Numeric(na);
        }
        case ValueTestType.StringType: {
          const sa = globalClient.getStringAssignment(
            subject.subjectKey,
            experiment,
            subject.subjectAttributes,
          );
          if (sa === null) return null;
          return EppoValue.String(sa);
        }
        case ValueTestType.JSONType: {
          const sa = globalClient.getJSONStringAssignment(
            subject.subjectKey,
            experiment,
            subject.subjectAttributes,
          );
          const oa = globalClient.getParsedJSONAssignment(
            subject.subjectKey,
            experiment,
            subject.subjectAttributes,
          );
          if (oa == null || sa === null) return null;
          return EppoValue.JSON(sa, oa);
        }
      }
    });
  }

  describe('initialization options', () => {
    const maxRetryDelay = POLL_INTERVAL_MS * POLL_JITTER_PCT;
    const mockConfigResponse = {
      flags: {
        [hashedFlagKey]: mockExperimentConfig,
      },
    } as unknown as Record<string, IExperimentConfiguration>;

    beforeAll(() => {
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
    });

    beforeEach(() => {
      // We're creating a new instance for each test so we need to clear the underlying storage too
      window.localStorage.clear();
    });

    afterEach(() => {
      jest.clearAllTimers();
      td.reset();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('default options', async () => {
      td.replace(HttpClient.prototype, 'get');
      let callCount = 0;
      td.when(HttpClient.prototype.get(td.matchers.anything())).thenDo(() => {
        if (++callCount === 1) {
          // Throw an error for the first call
          throw new Error('Intentional Thrown Error For Test');
        } else {
          // Return a mock object for subsequent calls
          return mockConfigResponse;
        }
      });

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
      expect(client.getStringAssignment('subject', flagKey)).toBe('control');

      // By default, no more calls
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
      expect(callCount).toBe(2);
    });

    it('polls after successful init if configured to do so', async () => {
      td.replace(HttpClient.prototype, 'get');
      let callCount = 0;
      td.when(HttpClient.prototype.get(td.matchers.anything())).thenDo(() => {
        callCount += 1;
        return mockConfigResponse;
      });

      // By not awaiting (yet) only the first attempt should be fired off before test execution below resumes
      const client = await init({
        apiKey,
        baseUrl,
        assignmentLogger: mockLogger,
        pollAfterSuccessfulInitialization: true,
      });
      expect(callCount).toBe(1);
      expect(client.getStringAssignment('subject', flagKey)).toBe('control');

      // Advance timers mid-init to allow retrying
      await jest.advanceTimersByTimeAsync(maxRetryDelay);

      // Should be polling
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
      expect(callCount).toBe(11);
    });

    it('gives up initial request and throws error after hitting max retries', async () => {
      td.replace(HttpClient.prototype, 'get');
      let callCount = 0;
      td.when(HttpClient.prototype.get(td.matchers.anything())).thenDo(async () => {
        callCount += 1;
        throw new Error('Intentional Thrown Error For Test');
      });

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

      // Assignments resolve to null
      const client = getInstance();
      expect(client.getStringAssignment('subject', flagKey)).toBeNull();

      // Expect no further configuration requests
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(callCount).toBe(1);
    });

    it('gives up initial request but still polls later if configured to do so', async () => {
      td.replace(HttpClient.prototype, 'get');
      let callCount = 0;
      td.when(HttpClient.prototype.get(td.matchers.anything())).thenDo(() => {
        if (++callCount <= 2) {
          // Throw an error for the first call
          throw new Error('Intentional Thrown Error For Test');
        } else {
          // Return a mock object for subsequent calls
          return mockConfigResponse;
        }
      });

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

      // Initial assignments resolve to null
      expect(client.getStringAssignment('subject', flagKey)).toBeNull();

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      // Expect a new call from poller
      expect(callCount).toBe(3);

      // Assignments now working
      expect(client.getStringAssignment('subject', flagKey)).toBe('control');
    });

    describe('With reloaded index module', () => {
      // eslint-disable-next-line @typescript-eslint/ban-types
      let init: Function;
      // eslint-disable-next-line @typescript-eslint/ban-types
      let getInstance: Function;
      beforeEach(() => {
        jest.isolateModules(() => {
          // Isolate and re-require so that the static instance is reset to it's default state
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const reloadedModule = require('./index');
          init = reloadedModule.init;
          getInstance = reloadedModule.getInstance;
        });
      });

      it('returns empty assignments pre-initialization by default', async () => {
        returnRac = () => mockConfigResponse;
        const client = getInstance();
        expect(client.getStringAssignment('subject', flagKey)).toBeNull();
        // don't await
        init({
          apiKey,
          baseUrl,
          assignmentLogger: mockLogger,
        });
        expect(client.getStringAssignment('subject', flagKey)).toBeNull();
        // Advance time so a poll happened and check again
        await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        expect(client.getStringAssignment('subject', flagKey)).toBe('control');
      });
    });
  });
});
