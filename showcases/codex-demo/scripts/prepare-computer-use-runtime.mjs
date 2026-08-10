import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const showcaseDir = path.resolve(scriptDir, '..');
const packageJsonPath = require.resolve('open-computer-use/package.json', { paths: [showcaseDir] });
const packageRoot = path.dirname(packageJsonPath);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const sourceApp = process.env.CODEX_DEMO_HELPER_APP?.trim()
  || path.join(packageRoot, 'dist', 'Open Computer Use.app');
const outputDir = path.join(showcaseDir, '.generated', 'computer-use-runtime');
const archivePath = path.join(outputDir, 'open-computer-use.zip');
const manifestPath = path.join(outputDir, 'manifest.json');
const requireNotarized = process.env.CODEX_DEMO_REQUIRE_NOTARIZED_HELPER === '1';
const signingIdentity = process.env.CODEX_DEMO_HELPER_SIGNING_IDENTITY?.trim();

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: options.stdio ?? 'pipe' });
}

function verifyNotarization(appPath) {
  run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
  run('/usr/bin/xcrun', ['stapler', 'validate', appPath]);
}

if (process.platform !== 'darwin') {
  throw new Error('Codex Demo currently packages the Computer Use runtime on macOS only.');
}

mkdirSync(outputDir, { recursive: true });
const stagingRoot = mkdtempSync(path.join(tmpdir(), 'codex-demo-computer-use-'));
const stagedApp = path.join(stagingRoot, 'Open Computer Use.app');

try {
  cpSync(sourceApp, stagedApp, { recursive: true, preserveTimestamps: true });

  let trustMode = 'developer-id';
  if (signingIdentity) {
    run('/usr/bin/codesign', [
      '--force',
      '--options', 'runtime',
      '--timestamp',
      '--sign', signingIdentity,
      stagedApp,
    ], { stdio: 'inherit' });
    trustMode = requireNotarized ? 'notarized-developer-id' : 'developer-id';
  } else if (requireNotarized) {
    // Accept an already signed and notarized upstream artifact without changing
    // its designated requirement.
    trustMode = 'notarized-developer-id';
  }

  run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', stagedApp], { stdio: 'inherit' });
  if (requireNotarized) verifyNotarization(stagedApp);

  rmSync(archivePath, { force: true });
  run('/usr/bin/ditto', [
    '-c', '-k', '--sequesterRsrc', '--keepParent', stagedApp, archivePath,
  ]);

  const sha256 = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  const runtimeId = createHash('sha256')
    .update(readFileSync(path.join(stagedApp, 'Contents', 'MacOS', 'OpenComputerUse')))
    .digest('hex');
  const manifest = {
    schemaVersion: 1,
    package: 'open-computer-use',
    version: packageJson.version,
    archive: path.basename(archivePath),
    sha256,
    runtimeId,
    appName: 'Open Computer Use.app',
    executable: 'Contents/MacOS/OpenComputerUse',
    bundleIdentifier: 'com.ifuryst.opencomputeruse',
    trustMode,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Prepared ${archivePath}`);
  console.log(`Trust mode: ${trustMode}`);
  console.log(`SHA-256: ${sha256}`);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
