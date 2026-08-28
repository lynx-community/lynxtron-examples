#!/usr/bin/env node
// Build every publishable showcase and pack it into a `.tgz` under a single
// output directory, ready to be uploaded as GitHub Release assets. Showcases
// with `showcase.distribution: "builtin"` are excluded from that public set;
// `--builtin` selects only those packages for embedding in the installer.
// Standalone cases such as codex-demo intentionally omit showcase metadata and
// are never built or packed here.
//
// This is the CI-facing counterpart to `scripts/preview.mjs`: preview packs
// tarballs next to each showcase and serves them via a local registry, whereas
// this script collects every tarball into one folder so the release workflow
// can glob-upload them in one step.
//
// Usage: node scripts/pack-showcases.mjs [--builtin] [--out <dir>]
//   --builtin  Pack only installer-bundled showcases; public mode excludes them.
//   --out  Output directory for the packed tarballs.
//          Defaults to dist/showcase-artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, readdir, rename } from 'node:fs/promises';
import {
  finalizeShowcaseTarball,
} from './showcase-release-pack.mjs';

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
const builtinOnly = process.argv.includes('--builtin');

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
  assertPortableDesktopOutput(dir);

  if (await hasWebTarget(dir)) {
    log(`Building ${name} web target...`);
    await run('pnpm', ['run', 'build:web'], { cwd: dir });
  }

  log(`Packing ${name} -> ${outDir}`);
  await run('pnpm', ['pack', '--pack-destination', outDir], { cwd: dir });
  const tarballPath = await renamePackedTarball(dir);
  await finalizeShowcaseTarball(tarballPath, path.join(dir, 'dist'));
}

function assertPortableDesktopOutput(showcaseDir) {
  const desktopDir = path.join(showcaseDir, 'dist', 'desktop');
  if (!fs.existsSync(desktopDir)) return;
  const pending = [desktopDir];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      const contents = fs.readFileSync(absolutePath, 'utf8');
      if (contents.includes(rootDir) || contents.includes(pathToFileURL(rootDir).href)) {
        throw new Error(
          `${path.relative(rootDir, absolutePath)} contains the build workspace path; `
          + 'externalize @lynx-js/lynxtron as commonjs lynxtron',
        );
      }
    }
  }
}

// `pnpm pack` names the tarball `<scope>-<name>-<version>.tgz` with no way to
// override it. Public assets drop that version so their Release URLs stay
// stable; built-in assets use the installer identity so cache keys rotate.
async function renamePackedTarball(showcaseDir) {
  const pkg = await readJson(path.join(showcaseDir, 'package.json'));
  const scopeless = pkg.name.replace(/^@/, '').replace('/', '-');
  const src = path.join(outDir, `${scopeless}-${pkg.version}.tgz`);
  // Built-in artifacts are cache-keyed by their installed filename. Include
  // the installer tag (or app version for local builds), so upgrading the app
  // cannot accidentally reuse an older extracted built-in showcase.
  const appVersion = (await readJson(path.join(rootDir, 'lynxtron-go', 'package.json'))).version;
  const rawIdentity = (process.env.LYNXTRON_RELEASE_TAG || `lynxtron-go-v${appVersion}`)
    .replace(/^lynxtron-go-v/, '');
  // Keep a semver prefix so the CLI can recover the bare package name, even
  // when workflow_dispatch supplied a custom tag rather than the default one.
  const installerIdentity = (rawIdentity.startsWith(appVersion)
    ? rawIdentity
    : `${appVersion}-${rawIdentity}`)
    .replace(/[^a-zA-Z0-9.+-]/g, '-');
  const destName = builtinOnly
    ? `${scopeless}-${installerIdentity}.tgz`
    : `${scopeless}.tgz`;
  const dest = path.join(outDir, destName);
  if (!fs.existsSync(src)) {
    throw new Error(`Expected tarball not found: ${src}`);
  }
  if (fs.existsSync(dest)) fs.rmSync(dest);
  await rename(src, dest);
  return dest;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  if (builtinOnly) {
    for (const file of await readdir(outDir)) {
      if (file.endsWith('.tgz')) fs.rmSync(path.join(outDir, file));
    }
  }

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
  const excludedBuiltinArtifactPrefixes = [];
  for (const dir of await listPackageDirs(path.join(rootDir, 'showcases'))) {
    const pkg = await readJson(path.join(dir, 'package.json'));
    if (!pkg.showcase) {
      log(`Skipping ${path.basename(dir)} (no "showcase" metadata in package.json)`);
      continue;
    }
    const isBuiltin = pkg.showcase.distribution === 'builtin';
    if (isBuiltin) excludedBuiltinArtifactPrefixes.push(pkg.name.replace(/^@/, '').replace('/', '-'));
    if (builtinOnly !== isBuiltin) {
      log(`Skipping ${path.basename(dir)} (${isBuiltin ? 'installer built-in' : 'published release'} showcase)`);
      continue;
    }
    await buildAndPackShowcase(dir);
  }

  const tarballs = (await readdir(outDir)).filter((f) => f.endsWith('.tgz')).sort();
  if (!builtinOnly) {
    const leakedBuiltin = tarballs.find(file => excludedBuiltinArtifactPrefixes.some(prefix =>
      file === `${prefix}.tgz` || file.startsWith(`${prefix}-`)
    ));
    if (leakedBuiltin) {
      throw new Error(`Built-in showcase artifact must not be published: ${leakedBuiltin}`);
    }
  }
  log(`Packed ${tarballs.length} ${builtinOnly ? 'built-in' : 'release'} showcase tarball(s):`);
  for (const tgz of tarballs) {
    log(`  - ${tgz}`);
  }
}

main().catch((error) => {
  console.error(`[pack-showcases] ${error.message}`);
  process.exitCode = 1;
});
