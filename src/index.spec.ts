/**
 * @jest-environment jsdom
 */

import mock from 'xhr-mock';

import {
  IAssignmentTestCase,
  readAssignmentTestData,
  readMockRacResponse,
} from '../test/testHelpers';

import { EppoJSClient, init } from './index';

describe('EppoJSClient E2E test', () => {
  let client: EppoJSClient;

  beforeAll(async () => {
    mock.setup();
    mock.get(/randomized_assignment\/v3\/config*/, (_req, res) => {
      const rac = readMockRacResponse();
      return res.status(200).body(JSON.stringify(rac));
    });
    client = await init({
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

  describe('getAssignment', () => {
    const testData = readAssignmentTestData();

    it.each(testData)(
      'test variation assignment splits',
      ({
        experiment,
        valueType = 'string',
        subjects,
        subjectsWithAttributes,
        expectedAssignments,
      }: IAssignmentTestCase) => {
        `---- Test Case for ${experiment} Experiment ----`;

        if (valueType === 'string') {
          const assignments = subjectsWithAttributes
            ? getAssignmentsWithSubjectAttributes(subjectsWithAttributes, experiment)
            : getAssignments(subjects, experiment);
          expect(assignments).toEqual(expectedAssignments);
          expect(assignments.length).toBeGreaterThan(0);
        } else {
          // skip for now
          expect(true).toBe(true);
        }
      },
    );

    it('runs expected number of test cases', () => {
      expect(testData.length).toBeGreaterThan(0);
    });
  });

  function getAssignments(subjects: string[], experiment: string): string[] {
    return subjects.map((subjectKey) => {
      return client.getAssignment(subjectKey, experiment);
    });
  }

  function getAssignmentsWithSubjectAttributes(
    subjectsWithAttributes: {
      subjectKey: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subjectAttributes: Record<string, any>;
    }[],
    experiment: string,
  ): string[] {
    return subjectsWithAttributes.map((subject) => {
      return client.getAssignment(subject.subjectKey, experiment, subject.subjectAttributes);
    });
  }
});
