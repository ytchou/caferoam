/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.test.*',
    '!**/*.d.ts',
    '!**/test-utils/**',
  ],
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  reporters: ['html', 'json', 'clear-text'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/report.json' },
  thresholds: { high: 80, low: 60, break: 60 },
  concurrency: 4,
  timeoutMS: 30000,
};
