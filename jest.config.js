/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: false,
  setupFilesAfterEnv: ['jest-extended/all', '<rootDir>/lib/test/setup.ts'],
  coverageDirectory: 'reports/coverage',
  reporters: ['default', ['jest-junit', { outputFile: 'reports/junit.xml' }]],
  coverageReporters: ['cobertura', 'lcov', 'text'],
};
