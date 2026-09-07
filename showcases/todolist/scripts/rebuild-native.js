#!/usr/bin/env node
'use strict';

// Wraps `lynxtron-rebuild` to work around a Windows-only bug in
// `@lynx-js/lynxtron-rebuild@0.0.19-alpha.1`: it seeds `node.lib` from
// `<lynxtron>/dist/lynxtron.dll.lib`, but `@lynx-js/lynxtron@0.0.19-alpha.1`
// moved the runtime into `dist/release/` and `dist/devtool/`, so the seed
// step silently no-ops and native-addon linking fails with LNK1181.
//
// We invoke `lynxtron-rebuild` once; on Windows, if it fails while `node.lib`
// is missing, we seed the file from whichever variant directory ships
// `lynxtron.dll.lib` and re-invoke. Non-Windows platforms pass through.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function findLynxtronDllLib(projectRoot) {
  let pkgPath;
  try {
    pkgPath = require.resolve('@lynx-js/lynxtron/package.json', { paths: [projectRoot] });
  } catch {
    return null;
  }
  const distDir = path.join(path.dirname(pkgPath), 'dist');
  const candidates = [
    path.join(distDir, 'release', 'lynxtron.dll.lib'),
    path.join(distDir, 'devtool', 'lynxtron.dll.lib'),
    path.join(distDir, 'lynxtron.dll.lib'),
  ];
  return candidates.find(fs.existsSync) ?? null;
}

function findHeadersDir(projectRoot) {
  let rebuildPkgPath;
  try {
    rebuildPkgPath = require.resolve('@lynx-js/lynxtron-rebuild/package.json', {
      paths: [projectRoot],
    });
  } catch {
    return null;
  }
  const rebuildRoot = path.dirname(rebuildPkgPath);
  const distDir = path.join(rebuildRoot, 'dist');
  if (!fs.existsSync(distDir)) return null;
  const entries = fs.readdirSync(distDir);
  const versionDir = entries.find(name => name.startsWith('v'));
  return versionDir ? path.join(distDir, versionDir) : null;
}

function seedNodeLib(projectRoot) {
  const src = findLynxtronDllLib(projectRoot);
  const headersDir = findHeadersDir(projectRoot);
  if (!src || !headersDir) return false;
  let seeded = false;
  for (const config of ['Release', 'Debug']) {
    const target = path.join(headersDir, config, 'node.lib');
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    console.log(`[rebuild-native] seeded ${target} from ${src}`);
    seeded = true;
  }
  return seeded;
}

function runRebuild(projectRoot) {
  const cli = require.resolve('@lynx-js/lynxtron-rebuild/bin/lynxtron-rebuild.js', {
    paths: [projectRoot],
  });
  const result = spawnSync(process.execPath, [cli], { cwd: projectRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const firstStatus = runRebuild(projectRoot);
  if (firstStatus === 0) return;
  if (process.platform !== 'win32') process.exit(firstStatus);

  const seeded = seedNodeLib(projectRoot);
  if (!seeded) process.exit(firstStatus);

  const secondStatus = runRebuild(projectRoot);
  process.exit(secondStatus);
}

main();
