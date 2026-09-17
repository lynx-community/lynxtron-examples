'use strict';

// Build on native runners: all embedded addons and CEF must match Node's arch.
function releasePlatform(platform = process.platform, arch = process.arch) {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) return `mac-${arch}`;
  if (platform === 'win32' && arch === 'x64') return 'win-x64';
  throw new Error(`Unsupported release target: ${platform}-${arch}`);
}
module.exports = { releasePlatform };
