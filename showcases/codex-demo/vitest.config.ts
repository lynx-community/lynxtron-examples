import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/app/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
