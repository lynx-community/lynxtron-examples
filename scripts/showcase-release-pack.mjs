import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, rename, rm } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cliRequire = createRequire(path.join(rootDir, 'packages', 'cli', 'package.json'));
const tar = cliRequire('tar');

async function releaseFormat() {
  return import(pathToFileURL(path.join(rootDir, 'packages', 'cli', 'dist', 'showcase-release.js')).href);
}

/**
 * Rewrite an npm tarball into the public showcase layout. pnpm performs
 * catalog/workspace dependency substitution while packing, so the source hash
 * must be calculated from the extracted package payload, not the checkout.
 */
export async function finalizeShowcaseTarball(tarballPath, localDistPath) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'lynxtron-showcase-release-'));
  const rewrittenTarball = path.join(temporaryRoot, 'showcase.tgz');
  try {
    await tar.x({ file: tarballPath, cwd: temporaryRoot });
    const packageRoot = path.join(temporaryRoot, 'package');
    if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
      throw new Error(`Packed showcase has no package/package.json: ${tarballPath}`);
    }
    // Build intermediates and local output are not part of the public source
    // snapshot. Only dist_precompiled/ has release artifact identity.
    const { prepareShowcasePackageForRelease } = await releaseFormat();
    prepareShowcasePackageForRelease(packageRoot, localDistPath);

    await tar.c({ gzip: true, file: rewrittenTarball, cwd: temporaryRoot }, ['package']);
    await rename(rewrittenTarball, tarballPath);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
