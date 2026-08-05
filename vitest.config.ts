import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/storybook/manager.ts', 'src/storybook/atomic-navigation.ts', 'src/storybook/coverage.ts', 'src/storybook/device-preview.ts'],
      thresholds: { lines: 95, functions: 95, statements: 95, branches: 90 },
      reporter: ['text', 'json-summary'],
    },
  },
});
