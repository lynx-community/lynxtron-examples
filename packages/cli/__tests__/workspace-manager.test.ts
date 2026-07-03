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
    expect(pkg.dependencies['@lynxtron-showcases/config']).toBeDefined();
  });

  it('rewrites workspace:* in showcase package.json', async () => {
    await manager.init();

    const showcaseDir = path.join(tmpDir, 'showcases', 'test-app');
    fs.mkdirSync(showcaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(showcaseDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        devDependencies: { '@lynxtron-showcases/config': 'workspace:*' },
      })
    );

    await manager.rewriteWorkspaceRefs('test-app');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(showcaseDir, 'package.json'), 'utf-8')
    );
    expect(pkg.devDependencies['@lynxtron-showcases/config']).not.toBe('workspace:*');
  });
});
