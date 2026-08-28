import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SHOWCASE_PRECOMPILED_ROOT,
  SHOWCASE_RELEASE_MANIFEST_FILE,
  calculateShowcaseSourceHash,
  prepareShowcasePackageForRelease,
  resolveShowcaseRunTarget,
  verifyShowcaseRelease,
  writeShowcaseReleaseManifest,
} from '../src/showcase-release';

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function writeDesktop(root: string, directory: 'dist' | 'dist_precompiled', marker: string): void {
  writeFile(root, `${directory}/desktop/main.js`, `// ${marker} main\n`);
  writeFile(root, `${directory}/desktop/main.lynx.bundle`, `${marker} bundle\n`);
  writeFile(root, `${directory}/desktop/package.json`, JSON.stringify({ main: 'main.js' }));
}

describe('showcase release format', () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    while (temporaryRoots.length) {
      fs.rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
    }
  });

  function makeShowcase(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-release-format-'));
    temporaryRoots.push(root);
    writeFile(root, 'package.json', JSON.stringify({ name: 'counter', showcase: {} }));
    writeFile(root, 'src/app.tsx', 'export const value = 1;\n');
    writeFile(root, 'lynx.config.ts', 'export default {};\n');
    writeDesktop(root, SHOWCASE_PRECOMPILED_ROOT, 'official');
    return root;
  }

  it('binds the published source tree to the complete precompiled artifact tree', () => {
    const root = makeShowcase();
    const manifest = writeShowcaseReleaseManifest(root);

    expect(manifest.source.hash).toBe(calculateShowcaseSourceHash(root));
    expect(manifest.artifact.files).toEqual([
      'desktop/main.js',
      'desktop/main.lynx.bundle',
      'desktop/package.json',
    ]);
    expect(verifyShowcaseRelease(root).status).toBe('verified');
    expect(resolveShowcaseRunTarget(root, 'desktop')).toMatchObject({
      kind: 'precompiled',
      path: path.join(root, 'dist_precompiled', 'desktop'),
    });
  });

  it('excludes every build output directory from the published source hash', () => {
    const root = makeShowcase();
    writeFile(root, 'output/bundle/lynx/main.lynx.bundle', 'intermediate one');
    writeDesktop(root, 'dist', 'local one');
    const before = calculateShowcaseSourceHash(root);

    writeFile(root, 'output/bundle/lynx/main.lynx.bundle', 'intermediate two');
    writeFile(root, 'dist/desktop/main.js', '// user custom dist\n');
    writeFile(root, 'dist_precompiled/desktop/main.js', '// changed artifact\n');

    expect(calculateShowcaseSourceHash(root)).toBe(before);
  });

  it('hashes source content and relative paths, not mtimes', () => {
    const root = makeShowcase();
    const sourceFile = path.join(root, 'src', 'app.tsx');
    const before = calculateShowcaseSourceHash(root);

    fs.utimesSync(sourceFile, new Date(1_000), new Date(Date.now() + 60_000));
    expect(calculateShowcaseSourceHash(root)).toBe(before);

    writeFile(root, 'src/app.tsx', 'export const value = 3;\n');
    expect(calculateShowcaseSourceHash(root)).not.toBe(before);
  });

  it('uses local dist after the user changes published source', () => {
    const root = makeShowcase();
    writeDesktop(root, 'dist', 'local');
    writeShowcaseReleaseManifest(root);

    writeFile(root, 'src/app.tsx', 'export const value = 2;\n');

    expect(verifyShowcaseRelease(root).status).toBe('source-mismatch');
    expect(resolveShowcaseRunTarget(root, 'desktop')).toMatchObject({
      kind: 'local',
      path: path.join(root, 'dist', 'desktop'),
    });
  });

  it('falls back to local dist when the matching release artifact is incomplete', () => {
    const root = makeShowcase();
    writeDesktop(root, 'dist', 'local');
    writeShowcaseReleaseManifest(root);
    fs.rmSync(path.join(root, 'dist_precompiled', 'desktop', 'main.lynx.bundle'));

    expect(verifyShowcaseRelease(root).status).toBe('artifact-invalid');
    expect(resolveShowcaseRunTarget(root, 'desktop').kind).toBe('local');
  });

  it('never treats an unverified dist directory as the official artifact', () => {
    const root = makeShowcase();
    writeDesktop(root, 'dist', 'user custom');
    fs.rmSync(path.join(root, SHOWCASE_PRECOMPILED_ROOT), { recursive: true, force: true });

    const target = resolveShowcaseRunTarget(root, 'desktop');
    expect(target.kind).toBe('local');
    expect(target.path).toBe(path.join(root, 'dist', 'desktop'));
  });

  it('finalizes the packed payload with only source and dist_precompiled identities', () => {
    const root = makeShowcase();
    fs.rmSync(path.join(root, SHOWCASE_PRECOMPILED_ROOT), { recursive: true, force: true });
    writeDesktop(root, 'dist', 'pack-time local');
    writeFile(root, 'output/bundle/lynx/main.lynx.bundle', 'intermediate');

    prepareShowcasePackageForRelease(root, path.join(root, 'dist'));

    expect(fs.existsSync(path.join(root, 'dist'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'output'))).toBe(false);
    expect(fs.existsSync(path.join(root, SHOWCASE_PRECOMPILED_ROOT, 'desktop', 'main.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, SHOWCASE_RELEASE_MANIFEST_FILE))).toBe(true);
    expect(verifyShowcaseRelease(root).status).toBe('verified');
  });
});
