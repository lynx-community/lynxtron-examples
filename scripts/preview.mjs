#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const noLaunch = process.argv.includes('--no-launch');
const registryPort = 4873;
const registryUrl = `http://localhost:${registryPort}`;
const registryAuthTokenArg = `--//localhost:${registryPort}/:_authToken=preview`;
const tempRoot = process.env.NPM_CACHE_DIR || os.tmpdir();
const npmCacheDir = path.join(tempRoot, 'npm-cache-lynxtron-examples');
const registryDir = path.join(os.tmpdir(), 'verdaccio-lynxtron');
const registryPidFile = path.join(os.tmpdir(), 'verdaccio-lynxtron.pid');

function log(message) {
  console.log(`[preview] ${message}`);
}

function warn(message) {
  console.warn(`[preview] ${message}`);
}

function command(name) {
  if (process.platform !== 'win32' || /\.(cmd|exe|bat)$/i.test(name)) {
    return name;
  }
  return `${name}.cmd`;
}

function run(name, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command(name), args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: false,
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} ${args.join(' ')} failed with ${signal ?? `exit code ${code}`}`));
    });
  });
}

async function removeTarballs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => rm(path.join(dir, entry.name), { force: true })));
}

async function findTarball(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => entry.name)
    .sort()[0];
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function hasWebTarget(dir) {
  const pkg = await readJson(path.join(dir, 'package.json'));
  const scripts = pkg.scripts || {};
  const explicitTargets = Array.isArray(pkg.showcase?.targets)
    ? pkg.showcase.targets
    : [];
  const inferredWebTarget =
    typeof scripts['build:web'] === 'string' &&
    (typeof scripts['start:web'] === 'string' || typeof scripts['dev:web'] === 'string') &&
    fs.existsSync(path.join(dir, 'src', 'main', 'web'));

  return explicitTargets.includes('web') || inferredWebTarget;
}

async function listPackageDirs(parentDir) {
  const entries = await readdir(parentDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
    .sort();
}

async function buildAndPackShowcase(dir) {
  const name = path.basename(dir);
  log(`Building ${name} desktop target...`);
  await run('pnpm', ['run', 'build'], { cwd: dir });

  if (await hasWebTarget(dir)) {
    log(`Building ${name} web target...`);
    await run('pnpm', ['run', 'build:web'], { cwd: dir });
  }

  await removeTarballs(dir);
  log(`Packing ${name}...`);
  await run('pnpm', ['pack', '--pack-destination', dir], { cwd: dir });

  const tgz = await findTarball(dir);
  if (!tgz) {
    throw new Error(`Failed to pack ${name}`);
  }
  log(`  -> ${tgz}`);
}

async function waitForRegistry() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${registryUrl}/-/ping`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Registry failed to become ready at ${registryUrl}`);
}

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already stopped.
  }
}

async function findPidsOnPort(port) {
  if (process.platform === 'win32') {
    // netstat parsing on Windows is best-effort; skip and rely on pidfile.
    return [];
  }
  return new Promise((resolve) => {
    const child = spawn('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.on('close', () => {
      const pids = stdout
        .split(/\s+/)
        .map((token) => Number(token))
        .filter((n) => Number.isInteger(n) && n > 0);
      resolve(pids);
    });
    child.on('error', () => resolve([]));
  });
}

async function stopRegistry() {
  // Kill anything recorded in the pidfile first.
  if (fs.existsSync(registryPidFile)) {
    const pidText = (await readFile(registryPidFile, 'utf8')).trim();
    const pid = Number(pidText);
    if (Number.isInteger(pid) && pid > 0) {
      log(`Stopping registry (pid ${pid})...`);
      if (process.platform === 'win32') {
        await run('taskkill.exe', ['/PID', String(pid), '/T', '/F']).catch(() => {});
      } else {
        killPid(pid);
      }
    }
    await rm(registryPidFile, { force: true });
  }

  // Also kill any stray process still holding the registry port. The pidfile
  // can go missing if the previous preview was interrupted, so port-based
  // cleanup is the only reliable way to prevent a stale verdaccio from
  // silently serving requests to the next run.
  const strays = await findPidsOnPort(registryPort);
  for (const pid of strays) {
    log(`Killing stray process on port ${registryPort} (pid ${pid})...`);
    killPid(pid);
  }

  // Wait until the port is actually free before returning, so the caller can
  // safely bind to it. SIGTERM can take a moment to be processed.
  for (let i = 0; i < 20; i += 1) {
    const remaining = await findPidsOnPort(registryPort);
    if (remaining.length === 0) {
      return;
    }
    if (i === 10) {
      for (const pid of remaining) {
        log(`Escalating to SIGKILL for pid ${pid}...`);
        try { process.kill(pid, 'SIGKILL'); } catch {}
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function startRegistry() {
  await stopRegistry();
  await rm(registryDir, { recursive: true, force: true });
  await mkdir(path.join(registryDir, 'storage'), { recursive: true });

  const storagePath = path.join(registryDir, 'storage').replace(/\\/g, '/');
  const configPath = path.join(registryDir, 'config.yaml');
  const logPath = path.join(registryDir, 'verdaccio.log');
  await writeFile(configPath, `storage: ${storagePath}
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@lynxtron-examples/*':
    access: $all
    publish: $anonymous
    unpublish: $anonymous
  '@lynx-js/*':
    access: $all
    proxy: bnpm
  '**':
    access: $all
    proxy: npmjs
server:
  keepAliveTimeout: 60
listen: 0.0.0.0:${registryPort}
log: { type: stdout, format: pretty, level: warn }
`);

  log(`Starting verdaccio on ${registryUrl}...`);
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(command('pnpm'), ['exec', 'verdaccio', '--config', configPath], {
    cwd: rootDir,
    detached: true,
    shell: process.platform === 'win32',
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  child.unref();

  await writeFile(registryPidFile, String(child.pid));
  await waitForRegistry();
  log(`Registry ready (pid ${child.pid})`);
}

async function publishWorkspacePackages() {
  await mkdir(npmCacheDir, { recursive: true });

  // npm's `publish` for a scoped package resolves the target registry via
  // `@scope:registry` before falling back to `--registry`. Passing
  // `--@lynxtron-examples:registry=...` forces our local verdaccio to win over
  // any user-configured scoped registry (e.g. the public npm registry pinned
  // by `publishConfig`).
  const scopedRegistryArg = `--@lynxtron-examples:registry=${registryUrl}`;
  const publishArgs = [
    '--cache', npmCacheDir,
    'publish',
    '--registry', registryUrl,
    scopedRegistryArg,
    registryAuthTokenArg,
  ];

  log('Publishing @lynxtron-examples/config to local registry...');
  await runNpmPublish(path.join(rootDir, 'packages', 'config'), publishArgs);

  log('Publishing @lynxtron-examples/cli to local registry...');
  await run('pnpm', ['run', 'build'], {
    cwd: path.join(rootDir, 'packages', 'cli'),
  });
  await runNpmPublish(path.join(rootDir, 'packages', 'cli'), publishArgs);
}

// Publishes a workspace package to the local registry even when it is marked
// `"private": true`. The private flag is a safeguard against accidental
// publish to the public npm registry; preview intentionally short-circuits it
// by writing a stripped copy of package.json for the duration of the publish
// call and always restoring the original, even on failure.
async function runNpmPublish(pkgDir, publishArgs) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  const original = await readFile(pkgJsonPath, 'utf8');
  const parsed = JSON.parse(original);
  const needsStrip = parsed.private === true;
  if (needsStrip) {
    const { private: _private, ...rest } = parsed;
    await writeFile(pkgJsonPath, JSON.stringify(rest, null, 2) + '\n');
  }
  try {
    await run('npm', publishArgs, { cwd: pkgDir });
  } finally {
    if (needsStrip) {
      await writeFile(pkgJsonPath, original);
    }
  }
}

async function main() {
  await mkdir(npmCacheDir, { recursive: true });

  log('=== Step 0: Build workspace tooling ===');
  await run('pnpm', [
    '--filter',
    '@lynxtron-examples/config',
    '--filter',
    '@lynxtron-examples/cli',
    'run',
    'build',
  ]);

  log('=== Step 1: Pack showcases ===');
  for (const dir of await listPackageDirs(path.join(rootDir, 'showcases'))) {
    await buildAndPackShowcase(dir);
  }

  const lynxtronGoDir = path.join(rootDir, 'lynxtron-go');
  const lynxtronGoPkg = await readJson(path.join(lynxtronGoDir, 'package.json'));
  if (lynxtronGoPkg.showcase) {
    await buildAndPackShowcase(lynxtronGoDir);
  }

  log('=== Step 2: Local registry ===');
  await startRegistry();
  await publishWorkspacePackages();
  log(`Registry running at ${registryUrl}`);

  const lynxtronWorkspace = path.join(os.homedir(), '.lynxtron-go');
  await mkdir(lynxtronWorkspace, { recursive: true });
  log(`Writing .npmrc to ${lynxtronWorkspace} (registry=${registryUrl})`);
  await writeFile(path.join(lynxtronWorkspace, '.npmrc'), `registry=${registryUrl}\n`);

  log('=== Step 3: Build Lynxtron GO (preview mode) ===');
  await rm(path.join(lynxtronGoDir, 'output', 'bundle'), { recursive: true, force: true });
  await rm(path.join(lynxtronGoDir, 'dist', 'desktop'), { recursive: true, force: true });
  await run('pnpm', ['run', 'build'], {
    cwd: lynxtronGoDir,
    env: {
      ...process.env,
      // Preview should validate packed tarballs via local-registry / file:// URLs.
      LYNXTRON_PREVIEW: '1',
      LYNXTRON_SHOWCASE_SOURCE: 'local-registry',
    },
  });

  if (noLaunch) {
    log('=== Build complete (--no-launch). Launch manually: ===');
    log('  cd lynxtron-go && npx lynxtron ./dist/desktop');
    return;
  }

  log('=== Step 4: Launching Lynxtron GO ===');
  log('Press Ctrl+C to stop.');
  await run('npx', ['lynxtron', './dist/desktop'], { cwd: lynxtronGoDir });
}

main().catch((error) => {
  warn(error.message);
  process.exitCode = 1;
});
