#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const supportedPlatforms = new Set(['darwin', 'win32']);
const forceBuild = process.env.LYNXTRON_FORCE_SCINTILLA_BUILD === '1';

if (!supportedPlatforms.has(process.platform) && !forceBuild) {
  console.log(`[lynxtron-scintilla-editor] Native build skipped on ${process.platform}; supported platforms: ${[...supportedPlatforms].join(', ')}.`);
  process.exit(0);
}

const command = process.platform === 'win32' ? 'cmake-js.cmd' : 'cmake-js';
const child = spawn(command, ['compile'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error('[lynxtron-scintilla-editor] Failed to start cmake-js:', error);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (code === 0) {
    if (process.platform === 'darwin') {
      // CMake's linker-generated ad-hoc signature is rejected by Endpoint
      // Security on some managed Macs. Re-sign the completed module explicitly
      // so the runtime can load local development builds.
      const modulePath = fileURLToPath(
        new URL('../build/Release/lynx_scintilla_module.node', import.meta.url),
      );
      const signer = spawn(
        '/usr/bin/codesign',
        ['--force', '--sign', '-', modulePath],
        { stdio: 'inherit' },
      );
      signer.on('error', (error) => {
        console.error(
          '[lynxtron-scintilla-editor] Failed to start codesign:',
          error,
        );
        process.exit(1);
      });
      signer.on('close', (signCode, signSignal) => {
        if (signSignal) {
          console.error(
            `[lynxtron-scintilla-editor] codesign exited with signal ${signSignal}`,
          );
        }
        process.exit(signCode ?? 1);
      });
      return;
    }
    process.exit(0);
    return;
  }
  if (signal) {
    console.error(`[lynxtron-scintilla-editor] cmake-js exited with signal ${signal}`);
  }
  process.exit(code ?? 1);
});
