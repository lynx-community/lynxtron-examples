import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { createCustomProjectFromArchive, isShowcaseProject } from './preload-showcase-service';
import { BLANK_PROJECT_FILES } from '../../app/fiddle/runner/blank-project';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('custom project starter', () => {
  it('keeps the complete source toolchain and removes release/build identity', async () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-starter-fixture-'));
    const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-projects-'));
    roots.push(fixture, projects);
    const packageDir = path.join(fixture, 'package');
    fs.mkdirSync(path.join(packageDir, 'src', 'app'), { recursive: true });
    fs.mkdirSync(path.join(packageDir, 'dist_precompiled', 'desktop'), { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({
      name: '@lynxtron-examples/hello-lynxtron',
      scripts: { build: 'starter-build' },
      showcase: { distribution: 'builtin' },
      repository: { type: 'git', url: 'https://example.test/repo' },
      dependencies: { starter: '1.0.0' },
    }));
    fs.writeFileSync(path.join(packageDir, 'lynx.config.ts'), 'export default {};');
    fs.writeFileSync(path.join(packageDir, 'src', 'app', 'App.tsx'), 'starter');
    fs.writeFileSync(path.join(packageDir, '.lynxtron-release.json'), '{}');
    fs.writeFileSync(path.join(packageDir, 'dist_precompiled', 'desktop', 'main.js'), 'artifact');
    const archive = path.join(fixture, 'starter.tgz');
    await tar.c({ gzip: true, cwd: fixture, file: archive }, ['package']);

    const project = await createCustomProjectFromArchive(archive, projects, {
      'src/app/App.tsx': 'custom',
      'package.json': JSON.stringify({ name: 'my-project', dependencies: { user: '2.0.0' } }),
      '../escape.txt': 'must not be written',
    });

    expect(isShowcaseProject(project)).toBe(false);
    expect(fs.readFileSync(path.join(project, 'src', 'app', 'App.tsx'), 'utf8')).toBe('custom');
    expect(fs.existsSync(path.join(project, 'lynx.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.lynxtron-release.json'))).toBe(false);
    expect(fs.existsSync(path.join(project, 'dist_precompiled'))).toBe(false);
    expect(fs.existsSync(path.join(project, '..', 'escape.txt'))).toBe(false);
    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg).toMatchObject({
      name: 'my-project',
      private: true,
      scripts: { build: 'starter-build' },
      dependencies: { starter: '1.0.0', user: '2.0.0' },
    });
    expect(pkg.showcase).toBeUndefined();
    expect(pkg.repository).toBeUndefined();
  });

  it('keeps the complete starter but replaces the Hello renderer for Blank', async () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-blank-fixture-'));
    const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-blank-projects-'));
    roots.push(fixture, projects);
    const packageDir = path.join(fixture, 'package');
    fs.mkdirSync(path.join(packageDir, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({
      name: '@lynxtron-examples/hello-lynxtron',
      scripts: { build: 'starter-build' },
    }));
    fs.writeFileSync(path.join(packageDir, 'lynx.config.ts'), 'export default {};');
    fs.writeFileSync(path.join(packageDir, 'src', 'app', 'App.tsx'), '<text>Hello, Lynxtron!</text>');
    const archive = path.join(fixture, 'starter.tgz');
    await tar.c({ gzip: true, cwd: fixture, file: archive }, ['package']);

    const project = await createCustomProjectFromArchive(
      archive,
      projects,
      BLANK_PROJECT_FILES,
    );

    const app = fs.readFileSync(path.join(project, 'src', 'app', 'App.tsx'), 'utf8');
    expect(app).toBe(BLANK_PROJECT_FILES['src/app/App.tsx']);
    expect(app).not.toContain('Hello, Lynxtron!');
    expect(fs.existsSync(path.join(project, 'lynx.config.ts'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).scripts.build)
      .toBe('starter-build');
  });
});
