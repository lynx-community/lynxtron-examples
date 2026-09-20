import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// pnpm's isolated linker cannot pack bundledDependencies. Bundle only local
// runtime dependencies after pnpm has substituted workspace/catalog versions.
// Keep the original file: source layout for editing and rebuilding in Go.
export async function bundleLocalDependencies(packageRoot, sourceRoot) {
  const manifestPath = path.join(packageRoot, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const locals = Object.entries(manifest.dependencies ?? {})
    .filter(([, version]) => version.startsWith('file:'));
  if (!locals.length) return;
  const require = createRequire(new URL('../packages/cli/package.json', import.meta.url));
  const tar = require('tar');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-bundle-'));
  const bundled = new Set();
  function dependencyDirectory(name, from) {
    const resolver = createRequire(path.join(from, 'package.json'));
    for (const search of resolver.resolve.paths(name) ?? []) {
      const candidate = path.join(search, name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    }
    throw new Error(`Install dependency ${name} before packing the showcase`);
  }
  async function bundle(name, directory, parent, ancestors = new Map()) {
    const identity = fs.realpathSync(directory);
    if (ancestors.get(name) === identity) return;
    const nextAncestors = new Map(ancestors).set(name, identity);
    const destination = path.join(parent, 'node_modules', name);
    if (fs.existsSync(destination)) return;
    const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temporaryRoot],
      { cwd: directory, encoding: 'utf8', shell: process.platform === 'win32' });
    const [{ filename }] = JSON.parse(output);
    fs.mkdirSync(destination, { recursive: true });
    await tar.x({ file: path.join(temporaryRoot, filename), cwd: destination, strip: 1 });
    const pkg = JSON.parse(fs.readFileSync(path.join(destination, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      const dependencyRoot = dependencyDirectory(dependency, directory);
      await bundle(dependency, dependencyRoot, destination, nextAncestors);
    }
  }
  try {
    for (const [name, version] of locals) {
      const relative = version.slice(5);
      const packedSource = path.resolve(packageRoot, relative);
      if (!packedSource.startsWith(path.resolve(packageRoot) + path.sep)
        || !fs.existsSync(path.join(packedSource, 'package.json'))) {
        throw new Error(`Local dependency ${name} must be included inside the showcase`);
      }
      await bundle(name, dependencyDirectory(name, sourceRoot), packageRoot);
      bundled.add(name);
    }
    manifest.bundledDependencies = [...new Set([...(manifest.bundledDependencies ?? []), ...bundled])];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
