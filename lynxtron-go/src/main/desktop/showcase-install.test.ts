// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildShowcaseInstallEnv,
  formatNodeVersionRequirementError,
  getShowcaseTargets,
  getShowcaseDependencyStatus,
  getShowcaseInstallFingerprint,
  getShowcaseInstallPlan,
  hasShowcaseScript,
  getNodeVersionRequirement,
  hasShowcaseSourceChangesSinceBuild,
  hasShowcaseWebSourceChangesSinceBuild,
  isShowcaseWebBuilt,
  isNodeVersionSatisfied,
} from './showcase-install';

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function touch(filePath: string, mtimeMs: number, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  const when = new Date(mtimeMs);
  fs.utimesSync(filePath, when, when);
}

describe('showcase install helpers', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
  }

  it('uses npm install for standalone showcases', () => {
    const showcaseDir = makeTempDir('lynxtron-standalone-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      devDependencies: {
        react: '^19.0.0',
      },
    });

    const plan = getShowcaseInstallPlan(showcaseDir);
    expect(plan.manager).toBe('npm');
    expect(plan.cwd).toBe(showcaseDir);
    expect(plan.args).toEqual(['install']);
    expect(plan.userConfigPath).toBeUndefined();
  });

  it('passes the preview workspace npm config to standalone showcase installs', () => {
    const workspaceRoot = makeTempDir('lynxtron-preview-workspace-');
    const showcaseDir = path.join(workspaceRoot, 'showcases', 'counter');
    fs.writeFileSync(path.join(workspaceRoot, '.npmrc'), 'registry=http://localhost:4873\n', 'utf-8');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      devDependencies: {
        '@lynxtron-showcases/config': '0.0.1',
      },
    });

    const plan = getShowcaseInstallPlan(showcaseDir);
    expect(plan.manager).toBe('npm');
    expect(plan.cwd).toBe(showcaseDir);
    expect(plan.args).toEqual(['install']);
    expect(plan.userConfigPath).toBe(path.join(workspaceRoot, '.npmrc'));
  });

  it('strips inherited npm registry env when a preview userconfig is present', () => {
    const env = buildShowcaseInstallEnv('/tmp/preview/.npmrc', {
      PATH: '/usr/bin',
      npm_config_registry: 'https://registry.npmjs.org/',
      NPM_CONFIG_USERCONFIG: '/tmp/global/.npmrc',
      npm_config_store_dir: '/tmp/pnpm-store',
    });

    expect(env.PATH).toBe('/usr/bin');
    expect(env.npm_config_registry).toBeUndefined();
    expect(env.NPM_CONFIG_USERCONFIG).toBe('/tmp/preview/.npmrc');
    expect(env.npm_config_store_dir).toBe('/tmp/pnpm-store');
  });

  it('uses workspace-root pnpm install for workspace showcases', () => {
    const repoRoot = makeTempDir('lynxtron-workspace-');
    const showcaseDir = path.join(repoRoot, 'showcases', 'counter');
    writeJson(path.join(repoRoot, 'package.json'), {
      name: 'workspace-root',
      private: true,
    });
    fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "showcases/*"\n', 'utf-8');
    fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n', 'utf-8');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      devDependencies: {
        '@lynxtron-showcases/config': 'workspace:*',
      },
    });

    const plan = getShowcaseInstallPlan(showcaseDir);
    expect(plan.manager).toBe('pnpm');
    expect(plan.cwd).toBe(repoRoot);
    expect(plan.args).toEqual(['install', '--filter', './showcases/counter...']);
  });

  it('prefers explicit showcase targets from package metadata', () => {
    const showcaseDir = makeTempDir('lynxtron-showcase-targets-explicit-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
      showcase: {
        targets: ['desktop', 'web'],
      },
      scripts: {
        build: 'echo desktop',
      },
    });

    expect(getShowcaseTargets(showcaseDir)).toEqual(['desktop', 'web']);
  });

  it('infers web target from scripts and src/main/web when metadata is absent', () => {
    const showcaseDir = makeTempDir('lynxtron-showcase-targets-infer-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
      scripts: {
        build: 'echo desktop',
        'build:web': 'echo web',
        'dev:web': 'rspack serve',
      },
    });
    fs.mkdirSync(path.join(showcaseDir, 'src', 'main', 'web'), { recursive: true });

    expect(getShowcaseTargets(showcaseDir)).toEqual(['desktop', 'web']);
  });

  it('does not infer web target when scripts or web host are missing', () => {
    const showcaseDir = makeTempDir('lynxtron-showcase-targets-desktop-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      scripts: {
        build: 'echo desktop',
        'build:web': 'echo web',
      },
    });

    expect(getShowcaseTargets(showcaseDir)).toEqual(['desktop']);
  });

  it('detects showcase scripts by name', () => {
    const showcaseDir = makeTempDir('lynxtron-showcase-scripts-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
      scripts: {
        'start:web': 'serve ./dist/web',
      },
    });

    expect(hasShowcaseScript(showcaseDir, 'start:web')).toBe(true);
    expect(hasShowcaseScript(showcaseDir, 'dev:web')).toBe(false);
  });

  it('marks missing node_modules as requiring install', () => {
    const showcaseDir = makeTempDir('lynxtron-status-missing-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });

    const status = getShowcaseDependencyStatus(showcaseDir, {});
    expect(status.needsInstall).toBe(true);
    expect(status.reason).toBe('missing-node-modules');
  });

  it('bootstraps install state when dependencies already exist', () => {
    const showcaseDir = makeTempDir('lynxtron-status-bootstrapped-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });
    fs.mkdirSync(path.join(showcaseDir, 'node_modules'), { recursive: true });

    const status = getShowcaseDependencyStatus(showcaseDir, {});
    expect(status.needsInstall).toBe(false);
    expect(status.reason).toBe('bootstrapped');
  });

  it('requires install after package.json changes', () => {
    const showcaseDir = makeTempDir('lynxtron-status-manifest-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });
    fs.mkdirSync(path.join(showcaseDir, 'node_modules'), { recursive: true });

    const fingerprint = getShowcaseInstallFingerprint(showcaseDir);
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      codexSmoke: true,
    });

    const status = getShowcaseDependencyStatus(showcaseDir, {
      [path.resolve(showcaseDir)]: fingerprint,
    });
    expect(status.needsInstall).toBe(true);
    expect(status.reason).toBe('manifest-changed');
  });

  it('tracks workspace root manifest changes in the fingerprint', () => {
    const repoRoot = makeTempDir('lynxtron-workspace-fingerprint-');
    const showcaseDir = path.join(repoRoot, 'showcases', 'counter');
    writeJson(path.join(repoRoot, 'package.json'), {
      name: 'workspace-root',
      private: true,
    });
    fs.writeFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "showcases/*"\n', 'utf-8');
    fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n', 'utf-8');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
      devDependencies: {
        '@lynxtron-showcases/config': 'workspace:*',
      },
    });

    const before = getShowcaseInstallFingerprint(showcaseDir);
    fs.writeFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'lockfileVersion: "9.1"\n', 'utf-8');
    const after = getShowcaseInstallFingerprint(showcaseDir);

    expect(after).not.toBe(before);
  });

  it('inherits node version requirement from workspace root engines', () => {
    const repoRoot = makeTempDir('lynxtron-workspace-node-');
    const showcaseDir = path.join(repoRoot, 'showcases', 'counter');
    writeJson(path.join(repoRoot, 'package.json'), {
      name: 'workspace-root',
      private: true,
      engines: {
        node: '>=22',
      },
    });
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });

    expect(getNodeVersionRequirement(showcaseDir)).toEqual({
      range: '>=22',
      sourceKind: 'engines',
    });
  });

  it('falls back to nearest .nvmrc when package engines are absent', () => {
    const repoRoot = makeTempDir('lynxtron-workspace-nvmrc-');
    const showcaseDir = path.join(repoRoot, 'showcases', 'counter');
    writeJson(path.join(repoRoot, 'package.json'), {
      name: 'workspace-root',
      private: true,
    });
    fs.writeFileSync(path.join(repoRoot, '.nvmrc'), '22\n', 'utf-8');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });

    expect(getNodeVersionRequirement(showcaseDir)).toEqual({
      range: '22',
      sourceKind: 'nvmrc',
    });
  });

  it('validates node versions against the current workspace requirement', () => {
    expect(isNodeVersionSatisfied('22.14.0', '>=22')).toBe(true);
    expect(isNodeVersionSatisfied('23.0.0', '>=22')).toBe(true);
    expect(isNodeVersionSatisfied('21.9.0', '>=22')).toBe(false);
    expect(isNodeVersionSatisfied('22.14.0', '22')).toBe(true);
    expect(isNodeVersionSatisfied('23.0.0', '22')).toBe(false);
    expect(isNodeVersionSatisfied('22.14.0', '>=22 <23')).toBe(true);
    expect(isNodeVersionSatisfied('23.0.0', '>=22 <23')).toBe(false);
  });

  it('formats a user-facing node version mismatch error', () => {
    // npm runs with Lynxtron-as-node — the message must blame the runtime,
    // not the system Node install.
    expect(formatNodeVersionRequirementError({ range: '>=22', sourceKind: 'engines' }, '20.11.1'))
      .toBe("Lynxtron's Node.js version 20.11.1 does not satisfy required version >=22. Update Lynxtron to a build shipping Node 22 or newer.");
    expect(formatNodeVersionRequirementError({ range: '22', sourceKind: 'nvmrc' }, null))
      .toBe("Lynxtron's Node.js runtime was not detected. Reinstall or update Lynxtron and retry.");
  });

  it('detects saved source changes newer than dist', () => {
    const showcaseDir = makeTempDir('lynxtron-source-newer-');
    const now = Date.now();
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });
    touch(path.join(showcaseDir, 'dist', 'desktop', 'main.js'), now - 10_000, 'built');
    touch(path.join(showcaseDir, 'src', 'index.tsx'), now, 'source');

    expect(hasShowcaseSourceChangesSinceBuild(showcaseDir)).toBe(true);
  });

  it('does not treat unrelated root artifacts as source changes', () => {
    const showcaseDir = makeTempDir('lynxtron-source-ignore-');
    const now = Date.now();
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });
    touch(path.join(showcaseDir, 'package.json'), now - 20_000);
    touch(path.join(showcaseDir, 'dist', 'desktop', 'main.js'), now, 'built');
    touch(path.join(showcaseDir, 'counter-0.0.1.tgz'), now + 10_000, 'artifact');

    expect(hasShowcaseSourceChangesSinceBuild(showcaseDir)).toBe(false);
  });

  it('tracks saved config changes newer than dist', () => {
    const showcaseDir = makeTempDir('lynxtron-config-newer-');
    const now = Date.now();
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'counter',
      private: true,
    });
    touch(path.join(showcaseDir, 'dist', 'desktop', 'main.js'), now - 10_000, 'built');
    touch(path.join(showcaseDir, 'rspack.config.ts'), now, 'export default {};');

    expect(hasShowcaseSourceChangesSinceBuild(showcaseDir)).toBe(true);
  });

  it('detects when web output is built', () => {
    const showcaseDir = makeTempDir('lynxtron-web-built-');
    touch(path.join(showcaseDir, 'dist', 'web', 'index.html'), Date.now(), '<!doctype html>');

    expect(isShowcaseWebBuilt(showcaseDir)).toBe(true);
  });

  it('treats missing web output as requiring source run', () => {
    const showcaseDir = makeTempDir('lynxtron-web-missing-');
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
    });

    expect(hasShowcaseWebSourceChangesSinceBuild(showcaseDir)).toBe(true);
  });

  it('detects saved source changes newer than web build', () => {
    const showcaseDir = makeTempDir('lynxtron-web-source-newer-');
    const now = Date.now();
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
    });
    touch(path.join(showcaseDir, 'dist', 'web', 'index.html'), now - 10_000, '<!doctype html>');
    touch(path.join(showcaseDir, 'src', 'main', 'web', 'web-host.ts'), now, 'console.log("newer");');

    expect(hasShowcaseWebSourceChangesSinceBuild(showcaseDir)).toBe(true);
  });

  it('does not mark web source newer when built web is up to date', () => {
    const showcaseDir = makeTempDir('lynxtron-web-up-to-date-');
    const now = Date.now();
    writeJson(path.join(showcaseDir, 'package.json'), {
      name: 'notes',
      private: true,
    });
    touch(path.join(showcaseDir, 'package.json'), now - 30_000);
    touch(path.join(showcaseDir, 'src', 'main', 'web', 'web-host.ts'), now - 20_000, 'console.log("src");');
    touch(path.join(showcaseDir, 'dist', 'web', 'index.html'), now, '<!doctype html>');

    expect(hasShowcaseWebSourceChangesSinceBuild(showcaseDir)).toBe(false);
  });
});
