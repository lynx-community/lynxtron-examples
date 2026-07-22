import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../src/workspace/manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceManager', () => {
  let tmpDir: string;
  let manager: WorkspaceManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-test-'));
    manager = new WorkspaceManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes workspace with package.json and pnpm-workspace.yaml', async () => {
    await manager.init();

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'pnpm-workspace.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'showcases'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'external'))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@lynx-js/react']).toBeDefined();
    expect(pkg.dependencies['@lynxtron-examples/config']).toBeDefined();
  });

  it('rewrites workspace:* in showcase package.json', async () => {
    await manager.init();

    const showcaseDir = path.join(tmpDir, 'showcases', 'test-app');
    fs.mkdirSync(showcaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(showcaseDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        devDependencies: { '@lynxtron-examples/config': 'workspace:*' },
      })
    );

    await manager.rewriteWorkspaceRefs('test-app');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(showcaseDir, 'package.json'), 'utf-8')
    );
    expect(pkg.devDependencies['@lynxtron-examples/config']).not.toBe('workspace:*');
  });

  it('rewrites catalog: refs against the workspace catalog', async () => {
    await manager.init();

    const showcaseDir = path.join(tmpDir, 'showcases', 'catalog-app');
    fs.mkdirSync(showcaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(showcaseDir, 'package.json'),
      JSON.stringify({
        name: 'catalog-app',
        dependencies: { '@lynx-js/lynxtron': 'catalog:' },
        devDependencies: { '@rspack/core': 'catalog:' },
      })
    );

    await manager.rewriteWorkspaceRefs('catalog-app');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(showcaseDir, 'package.json'), 'utf-8')
    );
    expect(pkg.dependencies['@lynx-js/lynxtron']).not.toBe('catalog:');
    expect(pkg.dependencies['@lynx-js/lynxtron']).toMatch(/^[\^~]?\d/);
    expect(pkg.devDependencies['@rspack/core']).not.toBe('catalog:');
  });

  it('removes stale localhost .npmrc left by preview mode', async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.npmrc'), 'registry=http://localhost:4873\n');
    await manager.init();
    expect(fs.existsSync(path.join(tmpDir, '.npmrc'))).toBe(false);
  });

  it('writes a catalog: block into pnpm-workspace.yaml', async () => {
    await manager.init();
    const ws = fs.readFileSync(path.join(tmpDir, 'pnpm-workspace.yaml'), 'utf-8');
    expect(ws).toContain('catalog:');
    expect(ws).toContain('@lynx-js/lynxtron');
  });
});
