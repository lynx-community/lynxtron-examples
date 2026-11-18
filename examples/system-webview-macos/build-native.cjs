const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

if (process.platform !== 'darwin') throw new Error('This example uses macOS WebKit.');
const headers = path.dirname(require.resolve('@lynx-js/lynx-library-headers/package.json'));
mkdirSync('build', { recursive: true });
execFileSync('xcrun', [
  'clang++', '-std=c++17', '-fobjc-arc', '-bundle', '-undefined', 'dynamic_lookup',
  '-I', path.join(headers, 'include'), '-framework', 'AppKit', '-framework', 'WebKit',
  'system_webview.mm', '-o', 'build/system_webview.node',
], { stdio: 'inherit' });
