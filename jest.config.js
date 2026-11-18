module.exports = {
  projects: [
    {
      displayName: 'legacy',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testMatch: ['<rootDir>/tests/**/*.spec.js']
    },
    {
      displayName: 'harness',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/harness/__tests__/**/*.spec.js']
    },
    {
      displayName: 'migrated',
      preset: 'jest-preset-angular',
      setupFilesAfterEnv: ['<rootDir>/migrated/setup-jest.ts'],
      testMatch: ['<rootDir>/migrated/**/*.spec.ts'],
      transform: {
        '^.+\\.(ts|js|mjs|html|svg)$': [
          'jest-preset-angular',
          { tsconfig: '<rootDir>/migrated/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' }
        ]
      }
    }
  ]
};
