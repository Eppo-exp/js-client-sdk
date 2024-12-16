import * as fs from 'fs';

import { Flag, VariationType, AttributeType, PrecomputedFlag } from '@eppo/js-client-sdk-common';

export const TEST_DATA_DIR = './test/data/ufc/';
export const ASSIGNMENT_TEST_DATA_DIR = TEST_DATA_DIR + 'tests/';
const MOCK_UFC_FILENAME = 'flags-v1';
export const MOCK_UFC_RESPONSE_FILE = `${MOCK_UFC_FILENAME}.json`;
export const OBFUSCATED_MOCK_UFC_RESPONSE_FILE = `${MOCK_UFC_FILENAME}-obfuscated.json`;

// export const TEST_PRECOMPUTED_DATA_DIR = './test/data/configuration-wire/';
// const MOCK_PRECOMPUTED_FILENAME = 'precomputed-v1';
// export const MOCK_PRECOMPUTED_RESPONSE_FILE = `${MOCK_PRECOMPUTED_FILENAME}.json`;
// export const OBFUSCATED_MOCK_PRECOMPUTED_RESPONSE_FILE = `${MOCK_PRECOMPUTED_FILENAME}-obfuscated.json`;

const TEST_CONFIGURATION_WIRE_DATA_DIR = './test/data/configuration-wire/';
const MOCK_PRECOMPUTED_FILENAME = 'precomputed-v1';
export const MOCK_PRECOMPUTED_WIRE_FILE = `${MOCK_PRECOMPUTED_FILENAME}.json`;
export const MOCK_DEOBFUSCATED_PRECOMPUTED_RESPONSE_FILE = `${MOCK_PRECOMPUTED_WIRE_FILE}-deobfuscated.json`;

export enum ValueTestType {
  BoolType = 'boolean',
  NumericType = 'numeric',
  StringType = 'string',
  JSONType = 'json',
}

// TODO: remove this once we can import from @eppo/js-client-sdk-common
enum FormatEnum {
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRECOMPUTED = 'PRECOMPUTED',
}

interface Environment {
  name: string;
}

export interface IConfigurationWire {
  version: number;
  precomputed: {
    subjectKey: string;
    subjectAttributes: Record<string, AttributeType>;
    fetchedAt: string;
    response: {
      createdAt: string;
      format: FormatEnum;
      obfuscated: boolean;
      environment: Environment;
      flags: Record<string, PrecomputedFlag>;
    };
  };
}

export interface SubjectTestCase {
  subjectKey: string;
  subjectAttributes: Record<string, AttributeType>;
  assignment: string | number | boolean | object;
}

export interface IAssignmentTestCase {
  flag: string;
  variationType: VariationType;
  defaultValue: string | number | boolean | object;
  subjects: SubjectTestCase[];
}

export function readMockUfcResponse(filename: string): {
  flags: Record<string, Flag>;
} {
  return JSON.parse(fs.readFileSync(TEST_DATA_DIR + filename, 'utf-8'));
}

export function readMockPrecomputedResponse(filename: string): string {
  return fs.readFileSync(TEST_CONFIGURATION_WIRE_DATA_DIR + filename, 'utf-8');
}

export function readAssignmentTestData(): IAssignmentTestCase[] {
  const testCaseData: IAssignmentTestCase[] = [];
  const testCaseFiles = fs.readdirSync(ASSIGNMENT_TEST_DATA_DIR);
  testCaseFiles.forEach((file) => {
    const testCase = JSON.parse(fs.readFileSync(ASSIGNMENT_TEST_DATA_DIR + file, 'utf8'));
    testCaseData.push(testCase);
  });
  return testCaseData;
}

export function getTestAssignments(
  testCase: IAssignmentTestCase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignmentFn: any,
  obfuscated = false,
): { subject: SubjectTestCase; assignment: string | boolean | number | object }[] {
  const assignments: {
    subject: SubjectTestCase;
    assignment: string | boolean | number | object;
  }[] = [];
  for (const subject of testCase.subjects) {
    const assignment =
      assignmentFn(
        testCase.flag,
        subject.subjectKey,
        subject.subjectAttributes,
        testCase.defaultValue,
        obfuscated,
      ) || testCase.defaultValue; // Fallback to defaultValue if null
    assignments.push({ subject: subject, assignment: assignment });
  }
  return assignments;
}

export function validateTestAssignments(
  assignments: {
    subject: SubjectTestCase;
    assignment: string | boolean | number | object;
  }[],
  flag: string,
) {
  for (const { subject, assignment } of assignments) {
    if (typeof assignment !== 'object') {
      // the expect works well for objects, but this comparison does not
      if (assignment !== subject.assignment) {
        throw new Error(
          `subject ${
            subject.subjectKey
          } was assigned ${assignment?.toString()} when expected ${subject.assignment?.toString()} for flag ${flag}`,
        );
      }
    }
    expect(subject.assignment).toEqual(assignment);
  }
}
