#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const sourceDir = path.resolve(path.dirname(__filename), '..');
const showcaseDir = path.resolve(sourceDir, '..');
// pnpm materializes file: dependencies separately; build the package AutoLink
// actually resolves, not an unrelated source-side binary.
const requireFromShowcase = createRequire(path.join(showcaseDir, 'package.json'));
const extensionDir = path.dirname(requireFromShowcase.resolve('lynxtron-native-texture-canvas/package.json'));

const supportedPlatforms = new Set(['darwin', 'win32']);
const forceBuild = process.env.LYNXTRON_FORCE_NATIVE_TEXTURE_BUILD === '1';

if (!supportedPlatforms.has(process.platform) && !forceBuild) {
  console.log(`[lynxtron-native-texture-canvas] Native build skipped on ${process.platform}; supported platforms are macOS and Windows.`);
  process.exit(0);
}

// MSBuild's tracking files exceed MAX_PATH inside pnpm's virtual store.
// Keep intermediate files short, but publish the binary to the package that
// AutoLink resolves. A unique directory also keeps concurrent builds separate.
const buildDir = process.platform === 'win32'
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-texture-'))
  : null;
// Run the JS entry directly so paths containing spaces need no shell quoting.
const child = spawn(process.execPath, [requireFromShowcase.resolve('cmake-js/bin/cmake-js'), 'compile',
  ...(buildDir ? ['--out', buildDir] : []),
  `--CDLYNX_HEADERS_ROOT=${path.dirname(requireFromShowcase.resolve('@lynx-js/lynx-library-headers/package.json'))}`,
  `--CDLYNXTRON_ROOT=${path.dirname(requireFromShowcase.resolve('@lynx-js/lynxtron/package.json'))}`,
], {
  cwd: extensionDir,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error('[lynxtron-native-texture-canvas] Failed to start cmake-js:', error);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (code === 0) {
    if (buildDir) {
      const releaseDir = path.join(extensionDir, 'build', 'Release');
      fs.mkdirSync(releaseDir, { recursive: true });
      fs.copyFileSync(path.join(buildDir, 'Release', 'native_texture_canvas_module.node'),
        path.join(releaseDir, 'native_texture_canvas_module.node'));
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    process.exit(0);
    return;
  }
  if (signal) {
    console.error(`[lynxtron-native-texture-canvas] cmake-js exited with signal ${signal}`);
  }
  if (buildDir) {
    console.error(`[lynxtron-native-texture-canvas] Build diagnostics retained at ${buildDir}`);
  }
  process.exit(code ?? 1);
});
