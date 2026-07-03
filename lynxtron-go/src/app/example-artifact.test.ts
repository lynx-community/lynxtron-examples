// @vitest-environment node
import fs from 'fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';

import {
  buildExampleArtifactRunContext,
  buildExampleArtifactWorkspaceView,
  buildExampleArtifactLoadingState,
  buildExampleArtifactMetadataUrl,
  normalizeExampleArtifactInput,
  pickExampleArtifactDefaultFile,
  pickExampleArtifactRunTemplate,
  validateExampleArtifactMetadata,
} from './shared/example-artifact';
import {
  createExampleArtifactWorkspaceSession,
  createFolderWorkspaceSession,
  createShowcaseWorkspaceSession,
  resolveWorkspaceRunTarget,
} from './shared/workspace-session';
import { fetchExampleArtifact, prepareExampleArtifactRunLauncher } from '../main/desktop/example-artifact';
import { DEBUG_LOG as DEBUG_LOG_PATH } from '../main/desktop/preload-log';

function createExampleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-example-fixture-'));
  const exampleRoot = path.join(root, 'view');
  fs.mkdirSync(path.join(exampleRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(exampleRoot, 'dist'), { recursive: true });

  fs.writeFileSync(
    path.join(exampleRoot, 'example-metadata.json'),
    JSON.stringify(
      {
        name: 'examples/view',
        files: ['src/App.tsx', 'dist/main.lynx.bundle', 'package.json', 'README.md'],
        templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
      },
      null,
      2,
    ),
    'utf-8',
  );
  fs.writeFileSync(path.join(exampleRoot, 'src', 'App.tsx'), 'export default function App() { return null; }\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'dist', 'main.lynx.bundle'), '{"template":"ok"}\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'package.json'), '{"name":"examples/view"}\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'README.md'), '# view example\n', 'utf-8');

  return {
    root,
    baseUrl: pathToFileURL(root).toString(),
  };
}

async function createHttpExampleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-example-http-fixture-'));
  const exampleRoot = path.join(root, 'view');
  fs.mkdirSync(path.join(exampleRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(exampleRoot, 'dist'), { recursive: true });

  fs.writeFileSync(
    path.join(exampleRoot, 'example-metadata.json'),
    JSON.stringify(
      {
        name: 'examples/view',
        files: ['src/App.tsx', 'dist/main.lynx.bundle', 'package.json', 'README.md'],
        templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
      },
      null,
      2,
    ),
    'utf-8',
  );
  fs.writeFileSync(path.join(exampleRoot, 'src', 'App.tsx'), 'export default function App() { return null; }\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'dist', 'main.lynx.bundle'), '{"template":"ok"}\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'package.json'), '{"name":"examples/view"}\n', 'utf-8');
  fs.writeFileSync(path.join(exampleRoot, 'README.md'), '# view example\n', 'utf-8');

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    if (filePath.endsWith('.json')) {
      res.setHeader('content-type', 'application/json');
    } else if (filePath.endsWith('.bundle')) {
      res.setHeader('content-type', 'application/octet-stream');
    } else {
      res.setHeader('content-type', 'text/plain; charset=utf-8');
    }
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to start HTTP fixture server');
  }

  return {
    root,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

describe('example artifact helpers', () => {
  it('normalizes example ids', () => {
    expect(normalizeExampleArtifactInput('  view  ')).toEqual({ ok: true, value: 'view' });
    expect(normalizeExampleArtifactInput('../view').ok).toBe(false);
    expect(normalizeExampleArtifactInput('https://example.com/view').ok).toBe(false);
  });

  it('builds metadata urls from the configured base', () => {
    expect(buildExampleArtifactMetadataUrl('view', 'https://host/base')).toBe(
      'https://host/base/view/example-metadata.json',
    );
  });

  it('builds a visible loading state for example artifact submit', () => {
    const viewLoading = buildExampleArtifactLoadingState('view');
    expect(viewLoading.message).toBe('Preparing workspace for view...');
    expect(viewLoading.minVisibleMs).toBe(900);

    const blankLoading = buildExampleArtifactLoadingState('   ');
    expect(blankLoading.message).toBe('Preparing workspace...');
    expect(blankLoading.minVisibleMs).toBe(viewLoading.minVisibleMs);
  });

  it('validates metadata structure', () => {
    const ok = validateExampleArtifactMetadata({
      name: 'examples/view',
      files: ['src/App.tsx'],
      templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
    });
    expect(ok.ok).toBe(true);

    const bad = validateExampleArtifactMetadata({
      name: 'examples/view',
      files: ['../escape.txt'],
      templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
    });
    expect(bad.ok).toBe(false);
  });

  it('selects a simple default file from metadata', () => {
    const metadata = {
      name: 'examples/view',
      files: ['src/App.tsx', 'dist/main.lynx.bundle', 'package.json', 'README.md'],
      templateFiles: [{ name: 'main', file: 'dist/main.lynx.bundle' }],
    };
    expect(pickExampleArtifactDefaultFile(metadata)).toBe('package.json');
  });

  it('prefers the first run template when multiple templates exist', () => {
    const metadata = {
      name: 'examples/view',
      files: ['src/App.tsx', 'dist/comp.lynx.bundle', 'dist/index.lynx.bundle'],
      templateFiles: [
        { name: 'comp', file: 'dist/comp.lynx.bundle' },
        { name: 'index', file: 'dist/index.lynx.bundle' },
      ],
    };
    expect(pickExampleArtifactRunTemplate(metadata)?.name).toBe('comp');
    expect(pickExampleArtifactRunTemplate(metadata)?.file).toBe('dist/comp.lynx.bundle');
  });

  it('falls back to the first run template when there is no main-named template', () => {
    const metadata = {
      name: 'examples/view',
      files: ['src/App.tsx', 'dist/comp.lynx.bundle', 'dist/alt.lynx.bundle'],
      templateFiles: [
        { name: 'comp', file: 'dist/comp.lynx.bundle' },
        { name: 'alt', file: 'dist/alt.lynx.bundle' },
      ],
    };
    expect(pickExampleArtifactRunTemplate(metadata)?.name).toBe('comp');
    expect(pickExampleArtifactRunTemplate(metadata)?.file).toBe('dist/comp.lynx.bundle');
  });

  it('builds a run context from the first template file when no default exists', () => {
    const runContext = buildExampleArtifactRunContext('/tmp/example-cache', {
      name: 'examples/view',
      files: ['src/App.tsx', 'dist/comp.lynx.bundle', 'dist/index.lynx.bundle'],
      templateFiles: [
        { name: 'comp', file: 'dist/comp.lynx.bundle' },
        { name: 'index', file: 'dist/index.lynx.bundle' },
      ],
    });
    expect(runContext).toEqual({
      cachePath: '/tmp/example-cache',
      templateFile: 'dist/comp.lynx.bundle',
      title: 'examples/view — comp',
    });
  });

  it('resolves run targets from explicit workspace session', () => {
    const exampleTarget = resolveWorkspaceRunTarget(createExampleArtifactWorkspaceSession({
      cachePath: '/tmp/example-cache',
      templateFile: 'dist/index.lynx.bundle',
      title: 'examples/view — index',
    }));
    expect(exampleTarget).toEqual({
      kind: 'example-artifact',
      cachePath: '/tmp/example-cache',
      templateFile: 'dist/index.lynx.bundle',
      title: 'examples/view — index',
    });

    const showcaseTarget = resolveWorkspaceRunTarget(createShowcaseWorkspaceSession('/tmp/showcase'));
    expect(showcaseTarget).toEqual({
      kind: 'showcase',
      rootPath: '/tmp/showcase',
    });

    const folderTarget = resolveWorkspaceRunTarget(createFolderWorkspaceSession('/tmp/folder'));
    expect(folderTarget).toEqual({
      kind: 'none',
      reason: 'Run is not available for folder workspaces',
    });
  });
});

describe('fetchExampleArtifact', () => {
  function resetDebugLog() {
    fs.mkdirSync(path.dirname(DEBUG_LOG_PATH), { recursive: true });
    fs.writeFileSync(DEBUG_LOG_PATH, '', 'utf-8');
  }

  it('downloads and parses a local example fixture', async () => {
    const fixture = createExampleFixture();
    try {
      resetDebugLog();
      const result = await fetchExampleArtifact('view', fixture.baseUrl);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.exampleId).toBe('view');
      expect(result.metadata.name).toBe('examples/view');
      expect(result.metadata.files).toEqual(
        expect.arrayContaining(['src/App.tsx', 'dist/main.lynx.bundle', 'package.json', 'README.md']),
      );
      expect(result.downloadedFiles[0].relativePath).toBe('example-metadata.json');
      expect(fs.existsSync(result.metadataPath)).toBe(true);
      expect(fs.existsSync(path.join(result.cachePath, 'src', 'App.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(result.cachePath, 'dist', 'main.lynx.bundle'))).toBe(true);
      const output = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8');
      expect(output).toContain('runtime env process.version=');
      expect(output).toContain('node=');
      expect(output).toContain('v8=');
      const workspace = buildExampleArtifactWorkspaceView(result.cachePath, result.metadata);
      expect(workspace.rootPath).toBe(result.cachePath);
      expect(workspace.dirContents.get(result.cachePath)?.some(node => node.name === 'src' && node.isDirectory)).toBe(true);
      expect(workspace.dirContents.get(result.cachePath)?.some(node => node.name === 'package.json' && !node.isDirectory)).toBe(true);
      expect(workspace.defaultFilePath).toBe(path.join(result.cachePath, 'package.json'));
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('smokes fetch -> cache -> workspace -> launcher wrapper on a local http fixture', async () => {
    const fixture = await createHttpExampleFixture();
    try {
      resetDebugLog();
      const result = await fetchExampleArtifact('view', fixture.baseUrl);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.metadata.name).toBe('examples/view');
      expect(result.downloadedFiles.map(file => file.relativePath)).toEqual(
        expect.arrayContaining([
          'example-metadata.json',
          'src/App.tsx',
          'dist/main.lynx.bundle',
          'package.json',
          'README.md',
        ]),
      );
      expect(fs.existsSync(path.join(result.cachePath, 'dist', 'main.lynx.bundle'))).toBe(true);
      expect(fs.existsSync(path.join(result.cachePath, 'src', 'App.tsx'))).toBe(true);
      const workspace = buildExampleArtifactWorkspaceView(result.cachePath, result.metadata);
      expect(workspace.rootPath).toBe(result.cachePath);
      expect(workspace.defaultFilePath).toBe(path.join(result.cachePath, 'package.json'));
      expect(workspace.dirContents.get(result.cachePath)?.some(node => node.name === 'src' && node.isDirectory)).toBe(true);
      expect(workspace.dirContents.get(result.cachePath)?.some(node => node.name === 'dist' && node.isDirectory)).toBe(true);

      const template = pickExampleArtifactRunTemplate(result.metadata);
      expect(template?.file).toBe('dist/main.lynx.bundle');
      const launcher = prepareExampleArtifactRunLauncher(
        result.cachePath,
        template?.file || 'dist/main.lynx.bundle',
        `${result.metadata.name} — ${template?.name || 'main'}`,
      );
      const mainJs = fs.readFileSync(path.join(launcher.distDesktop, 'main.js'), 'utf-8');
      expect(launcher.bundlePath).toBe(path.join(result.cachePath, 'dist', 'main.lynx.bundle'));
      expect(mainJs).toContain('LynxWindow');
      expect(mainJs).toContain('loadFile(BUNDLE_PATH)');
      expect(mainJs).toContain(JSON.stringify(path.join(result.cachePath, 'dist', 'main.lynx.bundle')));
    } finally {
      await fixture.close();
    }
  }, 15000);

  it('logs http metadata download failures with status context', async () => {
    const fixture = await createHttpExampleFixture();
    try {
      resetDebugLog();
      const result = await fetchExampleArtifact('missing-view', fixture.baseUrl);
      expect(result.ok).toBe(false);
      const output = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8');
      expect(output).toContain('download failure stage=metadata');
      expect(output).toContain('exampleId=missing-view');
      expect(output).toContain('status=404');
    } finally {
      await fixture.close();
    }
  });

  it('logs metadata download failures with url and stack context', async () => {
    const fixture = createExampleFixture();
    try {
      resetDebugLog();
      const result = await fetchExampleArtifact('missing-view', fixture.baseUrl);
      expect(result.ok).toBe(false);
      const output = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8');
      expect(output).toContain('download failure stage=metadata');
      expect(output).toContain('exampleId=missing-view');
      expect(output).toContain('url=file://');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('logs file download failures with relative path context', async () => {
    const fixture = createExampleFixture();
    try {
      fs.rmSync(path.join(fixture.root, 'view', 'README.md'), { force: true });
      resetDebugLog();
      const result = await fetchExampleArtifact('view', fixture.baseUrl);
      expect(result.ok).toBe(false);
      const output = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8');
      expect(output).toContain('download failure stage=file');
      expect(output).toContain('exampleId=view');
      expect(output).toContain('relativePath=README.md');
      expect(output).toContain('url=file://');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('prepares a launcher wrapper that loads the selected Lynx bundle', () => {
    const cachePath = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-example-launcher-'));
    try {
      fs.mkdirSync(path.join(cachePath, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(cachePath, 'dist', 'main.lynx.bundle'), '// bundle\n', 'utf-8');

      const launcher = prepareExampleArtifactRunLauncher(cachePath, 'dist/main.lynx.bundle', 'examples/view — main');
      const mainJs = fs.readFileSync(path.join(launcher.distDesktop, 'main.js'), 'utf-8');

      expect(launcher.bundlePath).toBe(path.join(cachePath, 'dist', 'main.lynx.bundle'));
      expect(mainJs).toContain('LynxWindow');
      expect(mainJs).toContain('loadFile(BUNDLE_PATH)');
      expect(mainJs).toContain(JSON.stringify(path.join(cachePath, 'dist', 'main.lynx.bundle')));
      expect(mainJs).toContain('examples/view — main');
      expect(fs.existsSync(path.join(launcher.distDesktop, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(launcher.launcherRoot, 'package.json'))).toBe(true);
    } finally {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }
  });

});
