import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  accessSync,
  constants,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const showcaseDir = path.resolve(scriptDir, '..');
const outputDir = path.join(showcaseDir, '.generated', 'opencode-runtime');
const outputArchive = path.join(outputDir, 'opencode.zip');
const outputManifest = path.join(outputDir, 'manifest.json');
const configuredArchive = process.env.CODEX_DEMO_OPENCODE_ARCHIVE?.trim();
const configuredBin = process.env.OPENCODE_BIN?.trim();
const cachedArchive = '/tmp/opencode-codex-demo/download/opencode-darwin-arm64.zip';

function executable(pathname) {
  try {
    accessSync(pathname, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

if (process.platform !== 'darwin') {
  throw new Error('Codex Demo currently packages OpenCode on macOS only.');
}

mkdirSync(outputDir, { recursive: true });
const stagingDir = mkdtempSync(path.join(tmpdir(), 'codex-demo-opencode-'));
try {
  const sourceArchive = configuredArchive || cachedArchive;
  if (sourceArchive) {
    try {
      copyFileSync(sourceArchive, outputArchive);
    } catch (error) {
      if (!configuredBin || !executable(configuredBin)) throw error;
      execFileSync('/usr/bin/ditto', ['-c', '-k', configuredBin, outputArchive]);
    }
  } else if (configuredBin && executable(configuredBin)) {
    execFileSync('/usr/bin/ditto', ['-c', '-k', configuredBin, outputArchive]);
  } else {
    throw new Error(
      'OpenCode runtime is missing. Set CODEX_DEMO_OPENCODE_ARCHIVE or OPENCODE_BIN before building.',
    );
  }

  execFileSync('/usr/bin/ditto', ['-x', '-k', outputArchive, stagingDir]);
  const stagedBin = path.join(stagingDir, 'opencode');
  if (!executable(stagedBin)) throw new Error('OpenCode archive does not contain an executable named opencode.');
  const version = execFileSync(stagedBin, ['--version'], { encoding: 'utf8' }).trim();
  const sha256 = createHash('sha256').update(readFileSync(outputArchive)).digest('hex');
  writeFileSync(outputManifest, `${JSON.stringify({
    schemaVersion: 1,
    version,
    archive: path.basename(outputArchive),
    executable: 'opencode',
    sha256,
  }, null, 2)}\n`);
  console.log(`Prepared OpenCode ${version} (${sha256}).`);
} finally {
  rmSync(stagingDir, { recursive: true, force: true });
}
