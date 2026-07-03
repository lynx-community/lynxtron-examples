// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TypeScriptLanguageService } from '../language-server/typescript';

// Use a fake file path that looks like an absolute path but doesn't exist on disk.
// The LanguageServiceHost falls back gracefully for missing lib files when
// skipLibCheck is true.
const FAKE_TS  = '/tmp/test-ide-mvp/src/test.ts';
const FAKE_JS  = '/tmp/test-ide-mvp/src/test.js';
const FAKE_TSX = '/tmp/test-ide-mvp/src/test.tsx';
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../../..');
const SHOWCASE_COUNTER_APP = path.join(REPO_ROOT, 'showcases/counter/src/app/App.tsx');
const SHOWCASE_COUNTER_DESKTOP_MAIN = path.join(REPO_ROOT, 'showcases/counter/src/main/desktop/main.ts');
const SHOWCASE_BENCHMARK_RSPACK_CONFIG = path.join(REPO_ROOT, 'showcases/benchmark/rspack.config.ts');
const SHOWCASE_CROSS_PLATFORM_NOTES_LYNX_CONFIG = path.join(REPO_ROOT, 'showcases/cross-platform-notes/lynx.config.ts');
const GO_DESKTOP_MAIN = path.join(REPO_ROOT, 'lynxtron-go/src/main/desktop/main.ts');
const GO_DESKTOP_PRELOAD = path.join(REPO_ROOT, 'lynxtron-go/src/main/desktop/preload.ts');
const GO_DESKTOP_VENDOR_PATHS = path.join(REPO_ROOT, 'lynxtron-go/src/main/desktop/vendorPaths.ts');

describe('TypeScriptLanguageService', () => {
  let svc: TypeScriptLanguageService;

  beforeEach(() => {
    svc = new TypeScriptLanguageService();
  });

  it('returns no diagnostics for syntactically valid TypeScript', () => {
    const code = `
const greet = (name: string): string => {
  return \`Hello, \${name}\`;
};
`;
    svc.updateFile(FAKE_TS, code, 1);
    const markers = svc.getDiagnostics(FAKE_TS);
    // No syntax errors expected
    const syntaxErrors = markers.filter(m => m.severity === 'error');
    expect(syntaxErrors).toHaveLength(0);
  });

  it('reports a syntax error for unclosed brace', () => {
    const code = 'function broken( { return 1; }';
    svc.updateFile(FAKE_TS, code, 1);
    const markers = svc.getDiagnostics(FAKE_TS);
    expect(markers.some(m => m.severity === 'error')).toBe(true);
  });

  it('reports a syntax error for invalid TypeScript syntax', () => {
    const code = 'const x: = 5;'; // missing type after colon
    svc.updateFile(FAKE_TS, code, 1);
    const markers = svc.getDiagnostics(FAKE_TS);
    expect(markers.some(m => m.severity === 'error')).toBe(true);
  });

  it('marker positions are 0-based line/char', () => {
    // Error is on line 1 (the second line), not line 0
    const code = '\nconst x: = 5;';
    svc.updateFile(FAKE_TS, code, 1);
    const markers = svc.getDiagnostics(FAKE_TS);
    expect(markers.length).toBeGreaterThan(0);
    // All line positions must be non-negative integers
    for (const m of markers) {
      expect(m.startLine).toBeGreaterThanOrEqual(0);
      expect(m.startChar).toBeGreaterThanOrEqual(0);
      expect(m.endLine).toBeGreaterThanOrEqual(m.startLine);
    }
  });

  it('marker includes message and source', () => {
    const code = 'const x: = 5;';
    svc.updateFile(FAKE_TS, code, 1);
    const markers = svc.getDiagnostics(FAKE_TS);
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) {
      expect(typeof m.message).toBe('string');
      expect(m.message.length).toBeGreaterThan(0);
      expect(m.source).toBe('typescript');
      expect(typeof m.code).toBe('number');
    }
  });

  it('incremental update: clears previous diagnostics when code is fixed', () => {
    svc.updateFile(FAKE_TS, 'const x: = 5;', 1);
    const broken = svc.getDiagnostics(FAKE_TS);
    expect(broken.some(m => m.severity === 'error')).toBe(true);

    svc.updateFile(FAKE_TS, 'const x: number = 5;', 2);
    const fixed = svc.getDiagnostics(FAKE_TS);
    expect(fixed.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('handles JavaScript files (allowJs: true) without crashing', () => {
    const code = 'function greet(name) { return "Hi " + name; }';
    svc.updateFile(FAKE_JS, code, 1);
    const markers = svc.getDiagnostics(FAKE_JS);
    // JS should produce no syntax errors for valid JS
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('handles JS syntax error', () => {
    const code = 'function (x { return x; }'; // missing function name
    svc.updateFile(FAKE_JS, code, 1);
    const markers = svc.getDiagnostics(FAKE_JS);
    expect(markers.some(m => m.severity === 'error')).toBe(true);
  });

  it('source is "javascript" for .js files', () => {
    svc.updateFile(FAKE_JS, 'function (x { }', 1);
    const markers = svc.getDiagnostics(FAKE_JS);
    // All markers for a .js file should have source === 'javascript'
    for (const m of markers) {
      expect(m.source).toBe('javascript');
    }
  });

  it('handles TSX files (JSX syntax) without crashing', () => {
    const code = `
const App = () => {
  return <div>Hello</div>;
};
`;
    svc.updateFile(FAKE_TSX, code, 1);
    // Should not crash — TSX extension enables JSX parsing automatically
    const markers = svc.getDiagnostics(FAKE_TSX);
    expect(Array.isArray(markers)).toBe(true);
  });

  it('independent instances do not share state', () => {
    const svc2 = new TypeScriptLanguageService();
    svc.updateFile(FAKE_TS, 'const x: = bad;', 1);
    svc2.updateFile(FAKE_TS, 'const x = 1;', 1);

    const markers1 = svc.getDiagnostics(FAKE_TS);
    const markers2 = svc2.getDiagnostics(FAKE_TS);

    expect(markers1.some(m => m.severity === 'error')).toBe(true);
    expect(markers2.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('uses showcase app tsconfig to avoid false JSX runtime diagnostics', () => {
    const code = fs.readFileSync(SHOWCASE_COUNTER_APP, 'utf8');
    svc.updateFile(SHOWCASE_COUNTER_APP, code, 1);

    const markers = svc.getDiagnostics(SHOWCASE_COUNTER_APP);

    expect(markers.some(m => m.code === 2875)).toBe(false);
    expect(markers.some(m => m.code === 7026)).toBe(false);
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('uses showcase desktop tsconfig to avoid false Node host diagnostics', () => {
    const code = fs.readFileSync(SHOWCASE_COUNTER_DESKTOP_MAIN, 'utf8');
    svc.updateFile(SHOWCASE_COUNTER_DESKTOP_MAIN, code, 1);

    const markers = svc.getDiagnostics(SHOWCASE_COUNTER_DESKTOP_MAIN);

    expect(markers.some(m => m.code === 2307 && m.message.includes("'path'"))).toBe(false);
    expect(markers.some(m => m.code === 2304 && m.message.includes('__dirname'))).toBe(false);
    expect(markers.some(m => m.code === 2584 && m.message.includes('console'))).toBe(false);
  });

  it('uses showcase package-local tools tsconfig for rspack config files', () => {
    const code = fs.readFileSync(SHOWCASE_BENCHMARK_RSPACK_CONFIG, 'utf8');
    svc.updateFile(SHOWCASE_BENCHMARK_RSPACK_CONFIG, code, 1);

    const markers = svc.getDiagnostics(SHOWCASE_BENCHMARK_RSPACK_CONFIG);

    expect(markers.some(m => m.message.includes('import.meta'))).toBe(false);
    expect(markers.some(m => m.message.includes("Cannot find name 'process'"))).toBe(false);
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('uses showcase package-local tools tsconfig for lynx config files', () => {
    const code = fs.readFileSync(SHOWCASE_CROSS_PLATFORM_NOTES_LYNX_CONFIG, 'utf8');
    svc.updateFile(SHOWCASE_CROSS_PLATFORM_NOTES_LYNX_CONFIG, code, 1);

    const markers = svc.getDiagnostics(SHOWCASE_CROSS_PLATFORM_NOTES_LYNX_CONFIG);

    expect(markers.some(m => m.message.includes("Cannot find name 'process'"))).toBe(false);
    expect(markers.some(m => m.code === 5097)).toBe(false);
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('loads ambient web declarations included by tsconfig', () => {
    const tempRoot = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-ts-service-web-'));
    const webRoot = path.join(tempRoot, 'src/main/web');
    fs.mkdirSync(webRoot, { recursive: true });

    const tsconfigPath = path.join(webRoot, 'tsconfig.json');
    const globalPath = path.join(webRoot, 'global.d.ts');
    const storagePath = path.join(webRoot, 'storage.ts');
    const hostPath = path.join(webRoot, 'web-host.ts');

    try {
      fs.writeFileSync(tsconfigPath, JSON.stringify({
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
          lib: ['ES2023', 'DOM'],
          strict: false,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
        include: ['./**/*.ts', './**/*.d.ts'],
      }, null, 2));

      fs.writeFileSync(storagePath, `
export interface NotesApi {
  ping(): string;
}

export const notesApi: NotesApi = {
  ping() {
    return 'ok';
  },
};
`);

      fs.writeFileSync(globalPath, `
import type { NotesApi } from './storage';

declare global {
  interface Window {
    __TEST_NOTES_API__?: NotesApi;
  }
}

export {};
`);

      fs.writeFileSync(hostPath, `
import { notesApi } from './storage';

if (typeof window !== 'undefined') {
  window.__TEST_NOTES_API__ = notesApi;
}
`);

      const code = fs.readFileSync(hostPath, 'utf8');
      svc.updateFile(hostPath, code, 1);

      const markers = svc.getDiagnostics(hostPath);

      expect(markers.some(m => m.code === 2339)).toBe(false);
      expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses bundled official Lynx toolchain types for fetched showcase app without install', () => {
    const tempRoot = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-ts-service-fetched-app-'));
    const appRoot = path.join(tempRoot, 'src/app');
    fs.mkdirSync(appRoot, { recursive: true });

    const tsconfigPath = path.join(appRoot, 'tsconfig.json');
    const appPath = path.join(appRoot, 'App.tsx');
    const indexPath = path.join(appRoot, 'index.tsx');

    try {
      fs.writeFileSync(tsconfigPath, JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          jsxImportSource: '@lynx-js/react',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
          lib: ['ES2023'],
          strict: false,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          types: ['@lynx-js/types'],
        },
        include: ['./**/*.ts', './**/*.tsx', './**/*.d.ts'],
      }, null, 2));

      fs.writeFileSync(appPath, `
import { useState } from '@lynx-js/react';

export function App() {
  const [count] = useState(1);
  return <view><text>{count}</text></view>;
}
`);

      fs.writeFileSync(indexPath, `
import { root } from '@lynx-js/react';
import { App } from './App';

root.render(<App />);
`);

      svc.updateFile(appPath, fs.readFileSync(appPath, 'utf8'), 1);
      const markers = svc.getDiagnostics(appPath);

      expect(markers.some(m => m.code === 2875)).toBe(false);
      expect(markers.some(m => m.code === 2307)).toBe(false);
      expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses bundled official Lynxtron host types for fetched desktop files without install', () => {
    const tempRoot = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-ts-service-fetched-desktop-'));
    const desktopRoot = path.join(tempRoot, 'src/main/desktop');
    fs.mkdirSync(desktopRoot, { recursive: true });

    const tsconfigPath = path.join(desktopRoot, 'tsconfig.json');
    const mainPath = path.join(desktopRoot, 'main.ts');
    const preloadPath = path.join(desktopRoot, 'preload.ts');

    try {
      fs.writeFileSync(tsconfigPath, JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          lib: ['ES2023'],
          strict: false,
          isolatedModules: true,
          verbatimModuleSyntax: false,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          skipLibCheck: true,
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          types: ['node'],
        },
        include: ['./**/*.ts', './**/*.d.ts'],
      }, null, 2));

      fs.writeFileSync(mainPath, `
import { app, LynxWindow } from '@lynx-js/lynxtron';
import path from 'path';

app.whenReady().then(() => {
  const win = new LynxWindow({ width: 800, height: 600 });
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
});
`);

      fs.writeFileSync(preloadPath, `
import { contextBridge } from '@lynx-js/lynxtron/context-bridge';
import fs from 'fs';
import path from 'path';
import os from 'os';

const filePath = path.join(os.tmpdir(), 'lynxtron-go-test.log');
if (fs.existsSync(filePath)) {
  console.log(process.pid);
}

contextBridge.exposeInLynxBTS({ bridge: { filePath } });
`);

      svc.updateFile(mainPath, fs.readFileSync(mainPath, 'utf8'), 1);
      const mainMarkers = svc.getDiagnostics(mainPath);

      svc.updateFile(preloadPath, fs.readFileSync(preloadPath, 'utf8'), 1);
      const preloadMarkers = svc.getDiagnostics(preloadPath);

      expect(mainMarkers.some(m => m.code === 2307)).toBe(false);
      expect(preloadMarkers.some(m => m.code === 2307)).toBe(false);
      expect(preloadMarkers.some(m => m.code === 2584 && m.message.includes('console'))).toBe(false);
      expect(preloadMarkers.some(m => m.message.includes('process'))).toBe(false);
      expect(mainMarkers.filter(m => m.severity === 'error')).toHaveLength(0);
      expect(preloadMarkers.filter(m => m.severity === 'error')).toHaveLength(0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('treats lynxtron-go desktop host sources as a Node environment', () => {
    for (const filePath of [GO_DESKTOP_MAIN, GO_DESKTOP_PRELOAD, GO_DESKTOP_VENDOR_PATHS]) {
      svc.updateFile(filePath, fs.readFileSync(filePath, 'utf8'), 1);
      const markers = svc.getDiagnostics(filePath);

      expect(markers.some(m => m.code === 2307)).toBe(false);
      expect(markers.some(m => m.code === 2584 && m.message.includes('console'))).toBe(false);
      expect(markers.some(m => m.message.includes("Cannot find name 'process'"))).toBe(false);
      expect(markers.some(m => m.message.includes("Cannot find name '__dirname'"))).toBe(false);
      expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
    }
  });

  it('uses bundled official rspeedy types for lynx config files without install', () => {
    const tempRoot = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-ts-service-fetched-lynx-config-'));
    const configPath = path.join(tempRoot, 'lynx.config.ts');

    try {
      fs.writeFileSync(configPath, `
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    filename: '[name].[platform].bundle',
  },
});
`);

      svc.updateFile(configPath, fs.readFileSync(configPath, 'utf8'), 1);
      const markers = svc.getDiagnostics(configPath);

      expect(markers.some(m => m.code === 2307)).toBe(false);
      expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('uses bundled official rspeedy/rspack types for config files without install', () => {
    const tempRoot = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-ts-service-fetched-config-'));
    const configPath = path.join(tempRoot, 'rspack.config.ts');

    try {
      fs.writeFileSync(configPath, `
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rspack';

export default defineConfig({
  plugins: [pluginLynxtron({ entry: './dist/desktop' })],
});

void rspack;
`);

      svc.updateFile(configPath, fs.readFileSync(configPath, 'utf8'), 1);
      const markers = svc.getDiagnostics(configPath);

      expect(markers.some(m => m.code === 2307)).toBe(false);
      expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
