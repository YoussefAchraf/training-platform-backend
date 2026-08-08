module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/docs/**', '!src/**/index.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  
  
  
  
  
  setupFiles: ['dotenv/config'],
};
