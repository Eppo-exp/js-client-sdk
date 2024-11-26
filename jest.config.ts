const jestConfig = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: './',
  moduleNameMapper: {
    '^src/(.*)': ['<rootDir>/src/$1'],
    '^test/(.*)': ['<rootDir>/test/$1'],
    '@eppo(.*)': '<rootDir>/node_modules/@eppo/$1',
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
  },
  testRegex: '.*\\..*spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: 'coverage/',
  testEnvironment: 'node',
};

export default jestConfig;
