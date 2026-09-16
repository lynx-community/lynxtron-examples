import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const requiredPackages = ['@lynx-js/lynxtron', '@lynx-js/cef-webview', '@lynx-js/lynxtron-dev-plugins'];

export function assertReleaseVersions(versions) {
  // 0.0.22 is usable for migration checks, not for publishing this showcase:
  // 0.0.23 adds native dependency boundaries, CEF profiles and the macOS bridge.
  const values = requiredPackages.map(name => versions[name]);
  for (const [index, version] of values.entries()) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
    const supported = match && (Number(match[1]) > 0 || Number(match[2]) > 0 || Number(match[3]) >= 23);
    if (!supported) throw new Error(`Browser release requires stable Lynxtron/CEF/tooling >= 0.0.23; ${requiredPackages[index]} is ${version}. Local build/start remains available.`);
  }
  if (new Set(values).size !== 1) throw new Error('Browser release requires matching Lynxtron, CEF and dev-plugin versions.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const require = createRequire(import.meta.url);
  const root = fileURLToPath(new URL('../', import.meta.url));
  assertReleaseVersions(Object.fromEntries(requiredPackages.map(name => [name, require(path.join(root, 'node_modules', name, 'package.json')).version])));
}
