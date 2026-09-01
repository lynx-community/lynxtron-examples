import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeShowcaseReleaseManifest } from '@lynxtron-examples/cli/dist/showcase-release.js';
import {
  isShowcaseProject,
  projectLaunchEnv,
  resolveLynxtronNodeRange,
  resolveProjectRunPlan,
} from './preload-showcase-service';

const roots: string[] = [];

function workspace(pkg: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-project-policy-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  return root;
}

function write(root: string, relativePath: string, contents: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function writeDesktopArtifact(root: string): void {
  write(root, 'dist_precompiled/desktop/main.js', '// main');
  write(root, 'dist_precompiled/desktop/main.lynx.bundle', 'bundle');
  write(root, 'dist_precompiled/desktop/package.json', '{"main":"main.js"}\n');
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('project run policy', () => {
  it('reads Node compatibility from the project Lynxtron package declaration', () => {
    const root = workspace({ name: 'custom', scripts: { build: 'build' } });
    write(root, 'node_modules/@lynx-js/lynxtron/package.json', JSON.stringify({
      name: '@lynx-js/lynxtron',
      version: '1.2.3',
      engines: { node: '>=20 <26' },
    }));

    expect(resolveLynxtronNodeRange(root)).toBe('>=20 <26');
  });

  it('launches every runtime as an independent app instance', () => {
    expect(projectLaunchEnv('/not-the-self-host', { PATH: '/system' })).toEqual({
      PATH: '/system',
      LYNXTRON_ALLOW_MULTI: '1',
    });
  });

  it('uses the source path for a regular project; dist is not an artifact signal', () => {
    const root = workspace({ name: 'custom', scripts: { build: 'build' } });
    write(root, 'dist/desktop/main.js', '// stale local build');
    write(root, 'dist/desktop/main.lynx.bundle', 'stale');
    write(root, 'dist/desktop/package.json', '{}');

    expect(isShowcaseProject(root)).toBe(false);
    expect(resolveProjectRunPlan(root)).toEqual({
      kind: 'source',
      path: path.join(root, 'dist', 'desktop'),
      reason: 'project is not a released showcase',
      projectKind: 'custom',
    });
  });

  it('runs an unchanged verified showcase from its precompiled artifact', () => {
    const root = workspace({
      name: '@lynxtron-examples/hello',
      showcase: { description: 'Hello' },
      scripts: { build: 'build' },
    });
    write(root, 'src/app.tsx', 'export default 1;\n');
    writeDesktopArtifact(root);
    writeShowcaseReleaseManifest(root);

    expect(isShowcaseProject(root)).toBe(true);
    expect(resolveProjectRunPlan(root)).toMatchObject({
      kind: 'precompiled',
      path: path.join(root, 'dist_precompiled', 'desktop'),
    });
  });

  it('sends a modified showcase through the same source path as custom', () => {
    const root = workspace({
      name: '@lynxtron-examples/hello',
      showcase: { description: 'Hello' },
      scripts: { build: 'build' },
    });
    write(root, 'src/app.tsx', 'export default 1;\n');
    writeDesktopArtifact(root);
    writeShowcaseReleaseManifest(root);
    write(root, 'src/app.tsx', 'export default 2;\n');

    expect(resolveProjectRunPlan(root)).toMatchObject({
      kind: 'source',
      projectKind: 'showcase',
      reason: expect.stringContaining('source hash mismatch'),
    });
  });

  it('sends a showcase with a corrupt artifact through source build', () => {
    const root = workspace({
      name: '@lynxtron-examples/hello',
      showcase: { description: 'Hello' },
      scripts: { build: 'build' },
    });
    write(root, 'src/app.tsx', 'export default 1;\n');
    writeDesktopArtifact(root);
    writeShowcaseReleaseManifest(root);
    write(root, 'dist_precompiled/desktop/main.js', '// corrupt');

    expect(resolveProjectRunPlan(root)).toMatchObject({
      kind: 'source',
      projectKind: 'showcase',
      reason: expect.stringContaining('artifact hash mismatch'),
    });
  });
});
