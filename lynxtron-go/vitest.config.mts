import { defineConfig } from 'vitest/config';

// Standalone vitest config for Lynxtron Go unit tests.
// We do not use createVitestConfig() from @byted-lynx/react/testing-library
// here because it installs a ReactLynx global setup that conflicts with
// Node-environment tests (extension-host) and is unnecessary for syntax tests.
//
// - syntax.test.ts / diagnostics.test.ts use jsdom (prismjs needs browser globals)
// - extension-host tests use node (via // @vitest-environment node)

export default defineConfig({
  test: {
    // Default environment: jsdom provides browser globals (Element, window, etc.)
    // needed by prismjs when running syntax.test.ts.
    environment: 'jsdom',
    include: [
      'src/app/syntax.test.ts',
      'src/app/diagnostics.test.ts',
      'src/app/example-artifact.test.ts',
      'src/app/shared/**/*.test.ts',
      'src/app/commands/**/*.test.ts',
      'src/main/desktop/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'src/extension-host/__tests__/**/*.test.ts',
    ],
  },
});
