#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distNodeModules = path.join(projectRoot, 'dist', 'desktop', 'node_modules');

function sortByPathName(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function packageNameFromRequest(request) {
  const normalized = request.replace(/\\/g, '/');
  if (normalized.startsWith('@')) {
    const [scope, name] = normalized.split('/');
    return name ? `${scope}/${name}` : normalized;
  }
  return normalized.split('/')[0];
}

function pnpmPackagePrefix(packageName) {
  return packageName.startsWith('@')
    ? `@${packageName.slice(1).replace('/', '+')}@`
    : `${packageName}@`;
}

function findNodeModulesRoots(fromDir) {
  const roots = [];
  let current = path.resolve(fromDir);

  while (true) {
    const nodeModulesRoot = path.join(current, 'node_modules');
    if (fs.existsSync(nodeModulesRoot)) {
      roots.push(nodeModulesRoot);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return roots;
    }
    current = parent;
  }
}

function findInstalledPackageDir(fromDir, packageName) {
  for (const nodeModulesRoot of findNodeModulesRoots(fromDir)) {
    const directDir = path.join(nodeModulesRoot, ...packageName.split('/'));
    if (fs.existsSync(path.join(directDir, 'package.json'))) {
      return directDir;
    }

    const hoistedPnpmDir = path.join(nodeModulesRoot, '.pnpm', 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(path.join(hoistedPnpmDir, 'package.json'))) {
      return hoistedPnpmDir;
    }

    const pnpmRoot = path.join(nodeModulesRoot, '.pnpm');
    if (!fs.existsSync(pnpmRoot)) {
      continue;
    }

    const prefix = pnpmPackagePrefix(packageName);
    const matches = fs.readdirSync(pnpmRoot)
      .map((name) => path.join(pnpmRoot, name))
      .filter((dir) => path.basename(dir).startsWith(prefix))
      .sort(sortByPathName)
      .reverse();

    for (const match of matches) {
      const packageDir = path.join(match, 'node_modules', ...packageName.split('/'));
      if (fs.existsSync(path.join(packageDir, 'package.json'))) {
        return packageDir;
      }
    }
  }

  return null;
}

function resolvePackageDir(request, fromDir = projectRoot) {
  const expectedName = packageNameFromRequest(request);
  try {
    let dir = path.dirname(require.resolve(request, { paths: [fromDir] }));
    while (true) {
      const manifestPath = path.join(dir, 'package.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          if (manifest.name === expectedName) {
            return dir;
          }
        } catch (_) {}
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  } catch (_) {}
  const installedDir = findInstalledPackageDir(fromDir, expectedName);
  if (installedDir) {
    return installedDir;
  }
  throw new Error(`Failed to locate package root for ${request}`);
}

function copyPackage(request, destination) {
  const source = resolvePackageDir(request);
  const target = path.join(distNodeModules, destination ?? request);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });
  console.log(`[pack] copied runtime dependency: ${request} -> ${target}`);
}

function copyPackageFrom(request, fromDir, destination) {
  const source = resolvePackageDir(request, fromDir);
  const target = path.join(distNodeModules, destination ?? request);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });
  console.log(`[pack] copied runtime dependency: ${request} -> ${target}`);
  return target;
}

function copyPackageEntries(request, entries, destination) {
  const source = resolvePackageDir(request);
  const target = path.join(distNodeModules, destination ?? request);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(target, entry);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true, dereference: true });
  }

  console.log(`[pack] copied runtime dependency entries: ${request} -> ${target}`);
  return target;
}

function copyDirectoryEntries(sourceRoot, entries, destination) {
  const target = path.join(distNodeModules, destination);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(target, entry);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true, dereference: true });
  }

  console.log(`[pack] copied runtime directory entries: ${sourceRoot} -> ${target}`);
  return target;
}

function sanitizeManifest(packageRoot) {
  const manifestPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.dependencies;
  delete manifest.devDependencies;
  delete manifest.scripts;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  if (!fs.existsSync(path.join(projectRoot, 'dist', 'desktop', 'package.json'))) {
    throw new Error('dist/desktop/package.json is missing; run the desktop build first.');
  }

  const lynxtronPackageJson = require(path.join(resolvePackageDir('@lynx-js/lynxtron'), 'package.json'));
  const lynxtronEntries = [...new Set([...(lynxtronPackageJson.files ?? []), 'package.json', 'dist'])];
  const lynxtronTarget = copyPackageEntries('@lynx-js/lynxtron', lynxtronEntries);
  sanitizeManifest(lynxtronTarget);

  copyPackage('@lynxtron-examples/cli');

  copyPackage('tar');
  const tarRoot = resolvePackageDir('tar');
  for (const dep of ['@isaacs/fs-minipass', 'chownr', 'minipass', 'minizlib', 'yallist']) {
    copyPackageFrom(dep, tarRoot);
  }

  copyPackage('@types/node/package.json', '@types/node');
  copyPackage('typescript');
  copyPackage('vscode-css-languageservice');
  const cssSourceRoot = resolvePackageDir('vscode-css-languageservice');
  copyPackageFrom('@vscode/l10n', cssSourceRoot);
  copyPackageFrom('vscode-uri', cssSourceRoot);

  const scintillaRoot = path.join(projectRoot, 'scintilla-extension');
  copyDirectoryEntries(
    scintillaRoot,
    [
      'package.json',
      'index.cjs',
      'build/Release/lynx_scintilla_module.node',
    ],
    'lynxtron-scintilla-editor',
  );
  sanitizeManifest(path.join(distNodeModules, 'lynxtron-scintilla-editor'));
}

main();
