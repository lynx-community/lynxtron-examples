#!/usr/bin/env node
import { spawn } from 'node:child_process';

const supportedPlatforms = new Set(['darwin', 'win32']);
const forceBuild = process.env.LYNXTRON_FORCE_HTTP_SERVICE_BUILD === '1';

if (!supportedPlatforms.has(process.platform) && !forceBuild) {
  console.log(`[lynxtron-http-service] Native build skipped on ${process.platform}; supported platforms: ${[...supportedPlatforms].join(', ')}.`);
  process.exit(0);
}

const command = process.platform === 'win32' ? 'cmake-js.cmd' : 'cmake-js';
const child = spawn(command, ['compile'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error('[lynxtron-http-service] Failed to start cmake-js:', error);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (code === 0) {
    process.exit(0);
    return;
  }
  if (signal) {
    console.error(`[lynxtron-http-service] cmake-js exited with signal ${signal}`);
  }
  process.exit(code ?? 1);
});
