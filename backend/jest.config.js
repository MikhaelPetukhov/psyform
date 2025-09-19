module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'config/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/migrations/**',
    '!**/seeders/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true
};
