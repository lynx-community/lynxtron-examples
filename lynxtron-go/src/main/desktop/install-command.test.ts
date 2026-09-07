import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatInstallEnvironmentHint, runBufferedCommand, runInstallCommand, type ShowcaseProcessOutputEntry } from './preload-showcase-service';

const roots: string[] = [];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go install test '));
  roots.push(root);
  const cwd = path.join(root, 'project & data');
  fs.mkdirSync(cwd);
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
    name: 'go-install-test', version: '1.0.0', private: true,
    scripts: { build: 'node build.cjs', fail: 'node fail.cjs' },
  }));
  fs.writeFileSync(path.join(cwd, 'build.cjs'),
    "require('fs').writeFileSync('result.json', JSON.stringify(process.argv.slice(2))); console.log('build-ok');");
  fs.writeFileSync(path.join(cwd, 'fail.cjs'), "console.error('intentional-build-failure'); process.exit(7);");
  return cwd;
}

describe('package manager subprocesses', () => {
  it('cancels the buffered CLI process used for showcase downloads', async () => {
    const cwd = makeProject();
    const controller = new AbortController();
    const pending = runBufferedCommand({ command: process.execPath,
      args: ['-e', "require('fs').writeFileSync('waiting.pid', String(process.pid)); setInterval(() => {}, 1000)"],
      cwd, env: process.env, timeoutMs: 10000, source: 'showcase.fetch', signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toThrow(/cancel/i);
    await expect.poll(() => fs.existsSync(path.join(cwd, 'waiting.pid'))).toBe(true);
    const pid = Number(fs.readFileSync(path.join(cwd, 'waiting.pid'), 'utf8'));
    controller.abort();
    await rejected;
    await expect.poll(() => {
      try { process.kill(pid, 0); return true; } catch { return false; }
    }).toBe(false);
  });

  it('identifies disk exhaustion without labelling other failures as disk errors', () => {
    expect(formatInstallEnvironmentHint('npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write'))
      .toContain('Free space on the project and npm cache drives');
    expect(formatInstallEnvironmentHint('Cannot find module')).toBe('');
  });
  it('installs and builds with real npm in a path containing spaces and shell characters', async () => {
    const cwd = makeProject();
    const outputBuffer: ShowcaseProcessOutputEntry[] = [];
    await runInstallCommand({ command: npm,
      args: ['install', '--include=dev', '--offline', '--no-audit', '--no-fund'],
      cwd, env: process.env, outputBuffer,
    });
    expect(fs.existsSync(path.join(cwd, 'package-lock.json'))).toBe(true);
    const argument = 'value with spaces & literal';
    await runInstallCommand({ command: npm, args: ['run', 'build', '--', argument],
      cwd, env: process.env, outputBuffer,
    });
    expect(JSON.parse(fs.readFileSync(path.join(cwd, 'result.json'), 'utf8'))).toEqual([argument]);
    expect(JSON.stringify(outputBuffer)).toContain('build-ok');
  });

  it('returns the actual build exit code and stderr', async () => {
    await expect(runInstallCommand({ command: npm, args: ['run', 'fail'],
      cwd: makeProject(), env: process.env,
    })).rejects.toMatchObject({
      message: expect.stringContaining('exit code 7'),
      stderr: expect.stringContaining('intentional-build-failure'),
    });
  });

  it('still launches native executables without treating arguments as shell code', async () => {
    const cwd = makeProject();
    await runInstallCommand({ command: process.execPath,
      args: ['build.cjs', 'literal & text'], cwd, env: process.env,
    });
    expect(JSON.parse(fs.readFileSync(path.join(cwd, 'result.json'), 'utf8'))).toEqual(['literal & text']);
  });
});
