module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/test'],
  collectCoverageFrom: ['lib/**/*.ts'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};
