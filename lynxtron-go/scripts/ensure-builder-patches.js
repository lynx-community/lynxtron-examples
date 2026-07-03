#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveFrom(baseDir, request) {
  return require.resolve(request, { paths: [baseDir] });
}

function ensureBuilderCliPackageResolution(builderRoot) {
  const cliPath = path.join(builderRoot, 'cli.js');
  const source = fs.readFileSync(cliPath, 'utf8');
  if (source.includes("'@lynx-js/lynxtron'")) {
    return;
  }

  const oldResolve = "const lynxtronEntryPath = require.resolve('@lynx-js/lynxtron', { paths: [projectRoot] });";
  const newResolve = `let lynxtronEntryPath;
    try {
      lynxtronEntryPath = require.resolve('@lynx-js/lynxtron', { paths: [projectRoot] });
    } catch (_) {
      lynxtronEntryPath = require.resolve('@lynx-js/lynxtron', { paths: [projectRoot] });
    }`;

  if (!source.includes(oldResolve)) {
    throw new Error(`Unable to patch lynxtron-builder package resolution in ${cliPath}`);
  }

  fs.writeFileSync(cliPath, source.replace(oldResolve, newResolve));
  console.log('[pack] patched lynxtron-builder package resolution.');
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const builderPackagePath = resolveFrom(projectRoot, '@lynx-js/lynxtron-builder/package.json');
  const builderRoot = path.dirname(builderPackagePath);
  ensureBuilderCliPackageResolution(builderRoot);

  const appBuilderPackagePath = resolveFrom(builderRoot, 'app-builder-lib/package.json');
  const appBuilderVersion = require(appBuilderPackagePath).version;
  const patchFile = path.join(builderRoot, 'patches', `app-builder-lib+${appBuilderVersion}.patch`);

  if (!fs.existsSync(patchFile)) {
    throw new Error(`Missing builder patch file: ${patchFile}`);
  }

  const appBuilderRoot = path.dirname(appBuilderPackagePath);
  const electronMacPath = path.join(appBuilderRoot, 'out', 'electron', 'electronMac.js');
  const electronMacSource = fs.readFileSync(electronMacPath, 'utf8');

  if (!electronMacSource.includes('function moveHelpers(')) {
    console.log('[pack] app-builder-lib helper patch already active; skip.');
    return;
  }

  console.log('[pack] applying lynxtron-builder patch directly to live app-builder-lib...');

  const applyResult = spawnSync('git', ['apply', '--unsafe-paths', `--directory=${appBuilderRoot}`, '-p3', patchFile], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (applyResult.status !== 0) {
    throw new Error(
      `git apply failed with status=${applyResult.status ?? 'unknown'}: ${applyResult.error?.message ?? 'no error detail'}`,
    );
  }

  const electronFrameworkPath = path.join(appBuilderRoot, 'out', 'electron', 'ElectronFramework.js');
  const electronFrameworkAfter = fs.readFileSync(electronFrameworkPath, 'utf8');
  if (!electronFrameworkAfter.includes('lynxtron')) {
    throw new Error(`builder patch was not applied to ${electronFrameworkPath}`);
  }

  console.log('[pack] app-builder-lib patch applied.');
}

main();
