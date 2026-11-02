import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.{ts,tsx}'], maxWorkers: 2, testTimeout: 20000 },
});
