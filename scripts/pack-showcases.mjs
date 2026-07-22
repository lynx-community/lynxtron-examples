#!/usr/bin/env node
// Build every showcase and pack it into a `.tgz` under a single output
// directory, ready to be uploaded as GitHub Release assets.
//
// This is the CI-facing counterpart to `scripts/preview.mjs`: preview packs
// tarballs next to each showcase and serves them via a local registry, whereas
// this script collects every tarball into one folder so the release workflow
// can glob-upload them in one step.
//
// Usage: node scripts/pack-showcases.mjs [--out <dir>]
//   --out  Output directory for the packed tarballs.
//          Defaults to dist/showcase-artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, readdir } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseOutDir() {
  const flagIndex = process.argv.indexOf('--out');
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return path.resolve(rootDir, process.argv[flagIndex + 1]);
  }
  return path.join(rootDir, 'dist', 'showcase-artifacts');
}

const outDir = parseOutDir();

function log(message) {
  console.log(`[pack-showcases] ${message}`);
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

  log(`Packing ${name} -> ${outDir}`);
  await run('pnpm', ['pack', '--pack-destination', outDir], { cwd: dir });
}

async function main() {
  await mkdir(outDir, { recursive: true });

  log('=== Build workspace tooling ===');
  await run('pnpm', [
    '--filter',
    '@lynxtron-examples/config',
    '--filter',
    '@lynxtron-examples/cli',
    'run',
    'build',
  ]);

  log('=== Pack showcases ===');
  for (const dir of await listPackageDirs(path.join(rootDir, 'showcases'))) {
    await buildAndPackShowcase(dir);
  }

  const tarballs = (await readdir(outDir)).filter((f) => f.endsWith('.tgz')).sort();
  log(`Packed ${tarballs.length} showcase tarball(s):`);
  for (const tgz of tarballs) {
    log(`  - ${tgz}`);
  }
}

main().catch((error) => {
  console.error(`[pack-showcases] ${error.message}`);
  process.exitCode = 1;
});
