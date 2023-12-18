/**
 * @jest-environment jsdom
 */

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

import { EppoJSClient, IAssignmentLogger, IEppoClient, init } from './index';

describe('EppoJSClient E2E test', () => {
  let globalClient: IEppoClient;

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
        conditions: [],
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
      const rac = readMockRacResponse();
      return res.status(200).body(JSON.stringify(rac));
    });
    globalClient = await init({
      apiKey: 'dummy',
      baseUrl: 'http://127.0.0.1:4000',
      assignmentLogger: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        logAssignment(assignment): Promise<void> {
          return Promise.resolve();
        },
      },
    });
  });

  afterAll(() => {
    mock.teardown();
  });

  it('assigns subject from overrides when experiment is enabled', () => {
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn({
      ...mockExperimentConfig,
      overrides: {
        '1b50f33aef8f681a13f623963da967ed': 'variant-2',
      },
      typedOverrides: {
        '1b50f33aef8f681a13f623963da967ed': 'variant-2',
      },
    });
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    const assignment = client.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual('variant-2');
  });

  it('assigns subject from overrides when experiment is not enabled', () => {
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn({
      ...mockExperimentConfig,
      overrides: {
        '1b50f33aef8f681a13f623963da967ed': 'variant-2',
      },
      typedOverrides: {
        '1b50f33aef8f681a13f623963da967ed': 'variant-2',
      },
    });
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    const assignment = client.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual('variant-2');
  });

  it('returns null when experiment config is absent', () => {
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn(null);
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    const assignment = client.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual(null);
  });

  it('logs variation assignment and experiment key', () => {
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn(mockExperimentConfig);
    const subjectAttributes = { foo: 3 };
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    const assignment = client.getAssignment('subject-10', flagKey, subjectAttributes);
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
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockLogger.logAssignment(td.matchers.anything())).thenThrow(new Error('logging error'));
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn(mockExperimentConfig);
    const subjectAttributes = { foo: 3 };
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    const assignment = client.getAssignment('subject-10', flagKey, subjectAttributes);
    expect(assignment).toEqual('control');
  });

  it('only returns variation if subject matches rules', () => {
    const mockConfigStore = td.object<EppoLocalStorage>();
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockConfigStore.get(hashedFlagKey)).thenReturn({
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
    });
    const client = new EppoJSClient(mockConfigStore);
    client.setLogger(mockLogger);
    let assignment = client.getAssignment('subject-10', flagKey, {
      appVersion: 9,
    });
    expect(assignment).toEqual(null);
    assignment = client.getAssignment('subject-10', flagKey);
    expect(assignment).toEqual(null);
    assignment = client.getAssignment('subject-10', flagKey, {
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
      ).toEqual(true);
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
});
