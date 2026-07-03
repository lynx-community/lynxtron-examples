import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'src/app/__tests__/index.test.tsx',
    ],
    testTimeout: process.platform === 'win32' ? 20_000 : 5_000,
  },
});
