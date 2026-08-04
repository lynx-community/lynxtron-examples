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

interface OpenCodeManifest {
  schemaVersion: 1;
  version: string;
  archive: string;
  executable: string;
  sha256: string;
}

function verify(bin: string, expectedVersion: string): void {
  accessSync(bin, constants.X_OK);
  const version = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim();
  if (version !== expectedVersion) {
    throw new Error(`OpenCode version mismatch: expected ${expectedVersion}, got ${version}`);
  }
}

export function installOpenCodeRuntime(resourceDir: string, installRoot: string): string {
  const manifestPath = path.join(resourceDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as OpenCodeManifest;
  if (manifest.schemaVersion !== 1 || !manifest.version || !manifest.sha256) {
    throw new Error(`Invalid OpenCode manifest: ${manifestPath}`);
  }

  const archive = path.join(resourceDir, manifest.archive);
  const actualHash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (actualHash !== manifest.sha256) {
    throw new Error(`OpenCode archive checksum mismatch: expected ${manifest.sha256}, got ${actualHash}`);
  }

  const releaseDir = path.join(installRoot, `${manifest.version}-${manifest.sha256.slice(0, 12)}`);
  const installedBin = path.join(releaseDir, manifest.executable);
  try {
    verify(installedBin, manifest.version);
    return installedBin;
  } catch {
    try {
      renameSync(releaseDir, `${releaseDir}.invalid-${Date.now()}`);
    } catch {
      // Not installed yet.
    }
  }

  mkdirSync(installRoot, { recursive: true });
  const stagingDir = mkdtempSync(path.join(installRoot, '.installing-'));
  try {
    execFileSync('/usr/bin/ditto', ['-x', '-k', archive, stagingDir]);
    verify(path.join(stagingDir, manifest.executable), manifest.version);
    renameSync(stagingDir, releaseDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenCode runtime installation failed: ${detail}`);
  }
  return installedBin;
}
