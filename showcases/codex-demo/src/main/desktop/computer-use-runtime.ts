import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import {
  accessSync,
  constants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'fs';
import path from 'path';

interface ComputerUseManifest {
  schemaVersion: 1;
  version: string;
  archive: string;
  sha256: string;
  runtimeId?: string;
  appName: string;
  executable: string;
  bundleIdentifier: string;
  trustMode: 'development-adhoc' | 'developer-id' | 'notarized-developer-id';
}

function run(command: string, args: string[]): void {
  execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
}

function sha256(pathname: string): string {
  return createHash('sha256').update(readFileSync(pathname)).digest('hex');
}

function verifyInstalledApp(appPath: string, manifest: ComputerUseManifest): void {
  run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', appPath]);
  if (manifest.trustMode === 'notarized-developer-id') {
    run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
    run('/usr/bin/xcrun', ['stapler', 'validate', appPath]);
  }
  accessSync(path.join(appPath, manifest.executable), constants.X_OK);
}

export function installComputerUseRuntime(resourceDir: string, installRoot: string): string {
  if (process.platform !== 'darwin') {
    throw new Error('The bundled Computer Use runtime currently supports Codex Demo on macOS only.');
  }

  const manifestPath = path.join(resourceDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ComputerUseManifest;
  if (manifest.schemaVersion !== 1 || !manifest.version || !manifest.sha256) {
    throw new Error(`Invalid Computer Use manifest: ${manifestPath}`);
  }

  const archivePath = path.join(resourceDir, manifest.archive);
  // ZIP metadata may change between builds even when the signed executable and
  // its TCC identity are unchanged. Key installations by runtime content.
  const releaseName = `${manifest.version}-${(manifest.runtimeId ?? manifest.sha256).slice(0, 12)}`;
  const releaseDir = path.join(installRoot, releaseName);
  const installedApp = path.join(releaseDir, manifest.appName);
  try {
    verifyInstalledApp(installedApp, manifest);
    return path.join(installedApp, manifest.executable);
  } catch {
    // Continue with a fresh atomic installation. Preserve a broken previous
    // install for diagnosis instead of overwriting code that may be running.
    try {
      renameSync(releaseDir, `${releaseDir}.invalid-${Date.now()}`);
    } catch {
      // The version has not been installed yet.
    }
  }

  const actualHash = sha256(archivePath);
  if (actualHash !== manifest.sha256) {
    throw new Error(`Computer Use archive checksum mismatch: expected ${manifest.sha256}, got ${actualHash}`);
  }

  mkdirSync(installRoot, { recursive: true });
  const stagingDir = mkdtempSync(path.join(installRoot, '.installing-'));
  try {
    run('/usr/bin/ditto', ['-x', '-k', archivePath, stagingDir]);
    const stagedApp = path.join(stagingDir, manifest.appName);
    verifyInstalledApp(stagedApp, manifest);
    renameSync(stagingDir, releaseDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Computer Use runtime installation failed: ${detail}`);
  }

  return path.join(installedApp, manifest.executable);
}
