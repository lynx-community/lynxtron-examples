const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const headers = path.dirname(require.resolve('@lynx-js/lynx-library-headers/package.json'));
mkdirSync('build', { recursive: true });
if (process.platform === 'win32') {
  if (process.arch !== 'x64') throw new Error('Use x64 Node.js and Lynxtron on Windows.');
  const { importLibraryPath } = require('@lynx-js/lynxtron/native-paths');
  execFileSync('cmake', ['-S', '.', '-B', 'build/cmake', '-A', 'x64',
    '-G', 'Visual Studio 17 2022', `-DLYNX_HEADERS=${headers}`,
    `-DLYNXTRON_IMPORT_LIB=${importLibraryPath}`], { stdio: 'inherit' });
  execFileSync('cmake', ['--build', 'build/cmake', '--config', 'Release'], { stdio: 'inherit' });
} else if (process.platform === 'darwin') {
  execFileSync('xcrun', [
    'clang++', '-std=c++17', '-fobjc-arc', '-bundle', '-undefined', 'dynamic_lookup',
    '-I', path.join(headers, 'include'), '-framework', 'AppKit', '-framework', 'WebKit',
    'system_webview.mm', '-o', 'build/system_webview.node',
  ], { stdio: 'inherit' });
} else {
  throw new Error('This system WebView example supports macOS and Windows x64.');
}
