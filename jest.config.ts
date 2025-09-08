/** @type {import('jest').Config} */
import type { JestConfigWithTsJest } from 'ts-jest';

export default {
  // 用 ts-jest 的 ESM preset
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  // 令 ts-jest 產生 ESM
  transform: { '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: { module: 'commonjs', jsx: 'react-jsx' } }] },
  // 讓 Jest 當 .ts 係 ESM
  extensionsToTreatAsEsm: ['.ts'],

  // 修正 ESM 匯入時自動加 .js 副檔名的 mapping（避免 TS import 路徑尾隨 .js 出錯）
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

                  // default: node for fast store tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.ts'],

} satisfies JestConfigWithTsJest;