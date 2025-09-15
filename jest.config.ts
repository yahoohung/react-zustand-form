import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest's ESM preset
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',

  collectCoverageFrom: ['src/**/*.{ts,tsx}'],

  // Tell Jest to treat .ts/.tsx files as ESM
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Configure ts-jest to use ESM with our dedicated test tsconfig
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.tests.json',
        useESM: true
      }
    ]
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],

  // If your tests mock Worker, include the setup file
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.ts'],

  // If you have ESM dependencies in node_modules that need to be transformed, configure them here if needed
  // Example: transformIgnorePatterns: ['/node_modules/(?!<esm-package-name>)']
};

export default config;