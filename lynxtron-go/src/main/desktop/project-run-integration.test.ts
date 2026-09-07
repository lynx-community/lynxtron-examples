// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeShowcaseReleaseManifest } from '@lynxtron-examples/cli/dist/showcase-release.js';

vi.mock('./preload-config-store', () => ({
  readInstallState: () => ({}),
  writeInstallState: () => {},
}));

import { createShowcaseService } from './preload-showcase-service';

// Fixture main.js files are valid no-op Node scripts on every platform.
const runtimeExecutable = process.execPath;
const roots: string[] = [];
const services: Array<ReturnType<typeof createShowcaseService>> = [];

function write(root: string, relativePath: string, contents: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function makeProject(kind: 'showcase' | 'custom'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `lynxtron-${kind}-run-`));
  roots.push(root);
  write(root, 'package.json', `${JSON.stringify({
    name: `run-${kind}`,
    private: true,
    engines: { node: '>=22' },
    scripts: { build: 'node build.mjs' },
    ...(kind === 'showcase' ? { showcase: { description: 'Run policy fixture' } } : {}),
  }, null, 2)}\n`);
  write(root, 'src/app.tsx', 'export default "initial";\n');
  write(root, 'build.mjs', [
    "import fs from 'fs';",
    "fs.mkdirSync('dist/desktop', { recursive: true });",
    "const countPath = '.build-count';",
    "const count = fs.existsSync(countPath) ? Number(fs.readFileSync(countPath, 'utf8')) + 1 : 1;",
    "fs.writeFileSync(countPath, String(count));",
    "fs.writeFileSync('dist/desktop/main.js', '// source build ' + count);",
    "fs.writeFileSync('dist/desktop/main.lynx.bundle', 'source bundle ' + count);",
    "fs.writeFileSync('dist/desktop/package.json', '{\"main\":\"main.js\"}\\n');",
  ].join('\n'));
  // The fixture has no dependencies. An empty node_modules marks dependency
  // setup complete so these tests exercise classification/build/launch only.
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
  return root;
}

function addReleaseArtifact(root: string): void {
  write(root, 'dist_precompiled/desktop/main.js', '// precompiled');
  write(root, 'dist_precompiled/desktop/main.lynx.bundle', 'precompiled bundle');
  write(root, 'dist_precompiled/desktop/package.json', '{"main":"main.js"}\n');
  writeShowcaseReleaseManifest(root);
}

function service() {
  const created = createShowcaseService(() => {});
  services.push(created);
  return created;
}

function launchCommandOutput(created: ReturnType<typeof createShowcaseService>) {
  return created.bridge.readProcessOutput()
    .filter(entry => entry.message.startsWith('$ '))
    .map(entry => ({ source: entry.source, message: entry.message }));
}

function buildCount(root: string): number {
  return Number(fs.readFileSync(path.join(root, '.build-count'), 'utf-8'));
}

afterEach(() => {
  for (const created of services.splice(0)) created.dispose();
  // Windows may release the child's working-directory handle just after kill.
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe('project build and launch matrix', () => {
  it('cancels an in-flight build before launch and allows the next project to run', async () => {
    const root = makeProject('custom');
    write(root, 'build.mjs', "import fs from 'fs'; fs.writeFileSync('.building', 'ready'); setInterval(() => {}, 1000);");
    const created = service();
    const pending = created.bridge.runProject(root, runtimeExecutable);
    const result = pending.then(() => null, error => error);
    try {
      await expect.poll(() => fs.existsSync(path.join(root, '.building')), { timeout: 15000 }).toBe(true);
    } finally {
      created.bridge.cancelTasks();
    }
    expect(await result).toHaveProperty('message', expect.stringMatching(/cancel/i));
    expect(launchCommandOutput(created).some(entry => entry.source === 'project.launch')).toBe(false);
    const next = makeProject('custom');
    const pid = await created.bridge.runProject(next, runtimeExecutable);
    expect(pid).toBeGreaterThan(0);
    expect(buildCount(next)).toBe(1);
  }, 30_000);

  it('stops the running project when its case is cancelled', async () => {
    const root = makeProject('showcase');
    addReleaseArtifact(root);
    write(root, 'dist_precompiled/desktop/main.js', 'setInterval(() => {}, 1000);');
    writeShowcaseReleaseManifest(root);
    const created = service();
    const pid = await created.bridge.runProject(root, runtimeExecutable);
    expect(created.bridge.isRunning(pid)).toBe(true);
    created.bridge.cancelTasks();
    expect(created.bridge.isRunning(pid)).toBe(false);
    await expect.poll(() => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    }).toBe(false);
  });

  it('runs an unchanged case directly from verified dist_precompiled', async () => {
    const root = makeProject('showcase');
    addReleaseArtifact(root);
    const created = service();

    await created.bridge.runProject(root, runtimeExecutable);

    expect(fs.existsSync(path.join(root, '.build-count'))).toBe(false);
    expect(launchCommandOutput(created)).toContainEqual({
      source: 'showcase.precompiled',
      message: `$ ${runtimeExecutable} ${path.join(root, 'dist_precompiled', 'desktop')}`,
    });
  });

  it('builds and launches a modified case from dist', async () => {
    const root = makeProject('showcase');
    addReleaseArtifact(root);
    write(root, 'src/app.tsx', 'export default "modified";\n');
    const created = service();

    await created.bridge.runProject(root, runtimeExecutable);

    expect(buildCount(root)).toBe(1);
    expect(launchCommandOutput(created)).toContainEqual({
      source: 'project.launch',
      message: `$ ${runtimeExecutable} ${path.join(root, 'dist', 'desktop')}`,
    });
  });

  it('falls back to source build when a case precompiled artifact is corrupt', async () => {
    const root = makeProject('showcase');
    addReleaseArtifact(root);
    write(root, 'dist_precompiled/desktop/main.lynx.bundle', 'corrupt');
    const created = service();

    await created.bridge.runProject(root, runtimeExecutable);

    expect(buildCount(root)).toBe(1);
    expect(launchCommandOutput(created)).toContainEqual({
      source: 'project.launch',
      message: `$ ${runtimeExecutable} ${path.join(root, 'dist', 'desktop')}`,
    });
  });

  it('always builds and launches a custom project from source', async () => {
    const root = makeProject('custom');
    // A stale dist must not turn a custom project into an artifact run.
    write(root, 'dist/desktop/main.js', '// stale');
    write(root, 'dist/desktop/main.lynx.bundle', 'stale');
    write(root, 'dist/desktop/package.json', '{"main":"main.js"}\n');
    const created = service();

    await created.bridge.runProject(root, runtimeExecutable);

    expect(buildCount(root)).toBe(1);
    expect(launchCommandOutput(created)).toContainEqual({
      source: 'project.launch',
      message: `$ ${runtimeExecutable} ${path.join(root, 'dist', 'desktop')}`,
    });
  });

  it('rebuilds a custom project after another source edit', async () => {
    const root = makeProject('custom');
    const created = service();
    await created.bridge.runProject(root, runtimeExecutable);
    created.bridge.readProcessOutput();
    write(root, 'src/app.tsx', 'export default "custom changed";\n');

    await created.bridge.runProject(root, runtimeExecutable);

    expect(buildCount(root)).toBe(2);
    expect(launchCommandOutput(created)).toContainEqual({
      source: 'project.launch',
      message: `$ ${runtimeExecutable} ${path.join(root, 'dist', 'desktop')}`,
    });
  });
});
