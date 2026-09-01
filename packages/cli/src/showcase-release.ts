import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const SHOWCASE_RELEASE_MANIFEST_FILE = '.lynxtron-release.json';
export const SHOWCASE_PRECOMPILED_ROOT = 'dist_precompiled';
export const SHOWCASE_LOCAL_BUILD_ROOT = 'dist';
export const SHOWCASE_TREE_HASH_ALGORITHM = 'sha256-tree-v1';

const SOURCE_EXCLUDED_ROOT_ENTRIES = new Set([
  '.git',
  '.lynxtron-go-cache.json',
  SHOWCASE_RELEASE_MANIFEST_FILE,
  SHOWCASE_PRECOMPILED_ROOT,
  SHOWCASE_LOCAL_BUILD_ROOT,
  'node_modules',
  'output',
]);

const DESKTOP_REQUIRED_FILES = ['main.js', 'main.lynx.bundle', 'package.json'] as const;
const WEB_REQUIRED_FILES = ['index.html'] as const;
const PNPM_COMMAND_PATTERN = /(^|[^a-z0-9_.-])pnpm(?:\.cmd)?(?=$|[^a-z0-9_.-])/i;

export interface ShowcaseReleaseTarget {
  root: string;
  requiredFiles: string[];
}

export interface ShowcaseReleaseManifest {
  schemaVersion: 1;
  hashAlgorithm: typeof SHOWCASE_TREE_HASH_ALGORITHM;
  source: {
    hash: string;
  };
  artifact: {
    root: typeof SHOWCASE_PRECOMPILED_ROOT;
    hash: string;
    files: string[];
    targets: Partial<Record<'desktop' | 'web', ShowcaseReleaseTarget>>;
  };
}

export type ShowcaseReleaseVerification =
  | { status: 'verified'; manifest: ShowcaseReleaseManifest }
  | { status: 'missing-manifest'; reason: string }
  | { status: 'invalid-manifest'; reason: string }
  | { status: 'source-mismatch'; reason: string }
  | { status: 'artifact-invalid'; reason: string };

export interface ShowcaseRunTarget {
  kind: 'precompiled' | 'local' | 'missing';
  path: string;
  reason: string;
}

interface TreeEntry {
  kind: 'file' | 'symlink';
  relativePath: string;
  contentHash: string;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function compareBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isSafeRelativePath(value: string): boolean {
  if (!value || path.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return normalized !== '..' && !normalized.startsWith('../') && normalized === value.replace(/\\/g, '/');
}

function collectTreeEntries(
  rootPath: string,
  shouldExcludeRootEntry?: (name: string) => boolean,
): TreeEntry[] {
  if (!fs.existsSync(rootPath)) return [];
  const entries: TreeEntry[] = [];

  const visit = (absoluteDir: string, relativeDir: string) => {
    const children = fs.readdirSync(absoluteDir, { withFileTypes: true })
      .sort((a, b) => compareBytes(a.name, b.name));
    for (const child of children) {
      if (!relativeDir && shouldExcludeRootEntry?.(child.name)) continue;
      const absolutePath = path.join(absoluteDir, child.name);
      const relativePath = toPosixPath(path.join(relativeDir, child.name));
      if (child.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (child.isFile()) {
        entries.push({
          kind: 'file',
          relativePath,
          contentHash: createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex'),
        });
      } else if (child.isSymbolicLink()) {
        entries.push({
          kind: 'symlink',
          relativePath,
          contentHash: createHash('sha256').update(fs.readlinkSync(absolutePath)).digest('hex'),
        });
      }
    }
  };

  visit(rootPath, '');
  return entries.sort((a, b) => compareBytes(a.relativePath, b.relativePath));
}

function hashTreeEntries(entries: TreeEntry[]): string {
  const aggregate = createHash('sha256');
  aggregate.update(`${SHOWCASE_TREE_HASH_ALGORITHM}\0`);
  for (const entry of entries) {
    aggregate.update(entry.kind);
    aggregate.update('\0');
    aggregate.update(entry.relativePath);
    aggregate.update('\0');
    aggregate.update(entry.contentHash);
    aggregate.update('\0');
  }
  return aggregate.digest('hex');
}

export function getShowcaseSourceFiles(showcasePath: string): string[] {
  return collectTreeEntries(showcasePath, name => SOURCE_EXCLUDED_ROOT_ENTRIES.has(name))
    .map(entry => entry.relativePath);
}

export function getShowcaseArtifactFiles(showcasePath: string): string[] {
  return collectTreeEntries(path.join(showcasePath, SHOWCASE_PRECOMPILED_ROOT))
    .map(entry => entry.relativePath);
}

export function calculateShowcaseSourceHash(showcasePath: string): string {
  return hashTreeEntries(collectTreeEntries(
    showcasePath,
    name => SOURCE_EXCLUDED_ROOT_ENTRIES.has(name),
  ));
}

export function calculateShowcaseArtifactHash(showcasePath: string): string {
  return hashTreeEntries(collectTreeEntries(path.join(showcasePath, SHOWCASE_PRECOMPILED_ROOT)));
}

function targetIfPresent(
  artifactRoot: string,
  target: 'desktop' | 'web',
  requiredFiles: readonly string[],
): ShowcaseReleaseTarget | undefined {
  const targetRoot = path.join(artifactRoot, target);
  if (!fs.existsSync(targetRoot)) return undefined;
  for (const requiredFile of requiredFiles) {
    if (!fs.existsSync(path.join(targetRoot, requiredFile))) {
      throw new Error(`Precompiled ${target} artifact is missing ${requiredFile}`);
    }
  }
  return { root: target, requiredFiles: [...requiredFiles] };
}

export function createShowcaseReleaseManifest(showcasePath: string): ShowcaseReleaseManifest {
  const artifactRoot = path.join(showcasePath, SHOWCASE_PRECOMPILED_ROOT);
  if (!fs.existsSync(artifactRoot)) {
    throw new Error(`Precompiled artifact root not found: ${artifactRoot}`);
  }
  const desktop = targetIfPresent(artifactRoot, 'desktop', DESKTOP_REQUIRED_FILES);
  const web = targetIfPresent(artifactRoot, 'web', WEB_REQUIRED_FILES);
  if (!desktop) {
    throw new Error('Precompiled desktop artifact is required');
  }

  return {
    schemaVersion: 1,
    hashAlgorithm: SHOWCASE_TREE_HASH_ALGORITHM,
    source: { hash: calculateShowcaseSourceHash(showcasePath) },
    artifact: {
      root: SHOWCASE_PRECOMPILED_ROOT,
      hash: calculateShowcaseArtifactHash(showcasePath),
      files: getShowcaseArtifactFiles(showcasePath),
      targets: { desktop, ...(web ? { web } : {}) },
    },
  };
}

export function writeShowcaseReleaseManifest(showcasePath: string): ShowcaseReleaseManifest {
  const manifest = createShowcaseReleaseManifest(showcasePath);
  fs.writeFileSync(
    path.join(showcasePath, SHOWCASE_RELEASE_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8',
  );
  return manifest;
}

function assertPortableReleaseScripts(showcasePath: string): void {
  const packagePath = path.join(showcasePath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
    scripts?: Record<string, unknown>;
  };
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (typeof command === 'string' && PNPM_COMMAND_PATTERN.test(command)) {
      throw new Error(
        `Published showcase script "${name}" must not require pnpm; use npm instead: ${command}`,
      );
    }
  }
}

/**
 * Convert an extracted npm package into the public Release layout.
 * package.json has already been normalized by pnpm at this point, so the
 * resulting source hash is exactly the hash consumers will recompute.
 */
export function finalizeShowcasePackageRoot(showcasePath: string): ShowcaseReleaseManifest {
  assertPortableReleaseScripts(showcasePath);
  fs.rmSync(path.join(showcasePath, SHOWCASE_LOCAL_BUILD_ROOT), { recursive: true, force: true });
  fs.rmSync(path.join(showcasePath, 'output'), { recursive: true, force: true });
  return writeShowcaseReleaseManifest(showcasePath);
}

export function prepareShowcasePackageForRelease(
  packedShowcasePath: string,
  localDistPath: string,
): ShowcaseReleaseManifest {
  if (!DESKTOP_REQUIRED_FILES.every(file => fs.existsSync(path.join(localDistPath, 'desktop', file)))) {
    throw new Error(`Local desktop build is incomplete: ${localDistPath}`);
  }
  const precompiledPath = path.join(packedShowcasePath, SHOWCASE_PRECOMPILED_ROOT);
  fs.rmSync(precompiledPath, { recursive: true, force: true });
  fs.cpSync(localDistPath, precompiledPath, { recursive: true, force: true });
  return finalizeShowcasePackageRoot(packedShowcasePath);
}

function parseShowcaseReleaseManifest(value: unknown): ShowcaseReleaseManifest | null {
  const manifest = value as ShowcaseReleaseManifest;
  if (manifest?.schemaVersion !== 1 || manifest.hashAlgorithm !== SHOWCASE_TREE_HASH_ALGORITHM) return null;
  if (!/^[a-f0-9]{64}$/.test(manifest.source?.hash ?? '')) return null;
  if (manifest.artifact?.root !== SHOWCASE_PRECOMPILED_ROOT) return null;
  if (!/^[a-f0-9]{64}$/.test(manifest.artifact?.hash ?? '')) return null;
  if (!Array.isArray(manifest.artifact?.files) || !manifest.artifact.files.every(isSafeRelativePath)) return null;
  const targets = manifest.artifact?.targets;
  if (!targets?.desktop) return null;
  for (const [targetName, target] of Object.entries(targets)) {
    if (targetName !== 'desktop' && targetName !== 'web') return null;
    if (!target || target.root !== targetName || !Array.isArray(target.requiredFiles)) return null;
    if (!target.requiredFiles.every(isSafeRelativePath)) return null;
  }
  return manifest;
}

export function readShowcaseReleaseManifest(showcasePath: string): ShowcaseReleaseManifest | null {
  try {
    return parseShowcaseReleaseManifest(JSON.parse(fs.readFileSync(
      path.join(showcasePath, SHOWCASE_RELEASE_MANIFEST_FILE),
      'utf-8',
    )));
  } catch {
    return null;
  }
}

export function verifyShowcaseRelease(showcasePath: string): ShowcaseReleaseVerification {
  const manifestPath = path.join(showcasePath, SHOWCASE_RELEASE_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return { status: 'missing-manifest', reason: `${SHOWCASE_RELEASE_MANIFEST_FILE} not found` };
  }
  const manifest = readShowcaseReleaseManifest(showcasePath);
  if (!manifest) {
    return { status: 'invalid-manifest', reason: `${SHOWCASE_RELEASE_MANIFEST_FILE} is invalid` };
  }

  const actualSourceHash = calculateShowcaseSourceHash(showcasePath);
  if (actualSourceHash !== manifest.source.hash) {
    return {
      status: 'source-mismatch',
      reason: `source hash mismatch: expected ${manifest.source.hash}, got ${actualSourceHash}`,
    };
  }

  const actualFiles = getShowcaseArtifactFiles(showcasePath);
  if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.artifact.files)) {
    return { status: 'artifact-invalid', reason: 'precompiled artifact file list mismatch' };
  }
  const actualArtifactHash = calculateShowcaseArtifactHash(showcasePath);
  if (actualArtifactHash !== manifest.artifact.hash) {
    return {
      status: 'artifact-invalid',
      reason: `artifact hash mismatch: expected ${manifest.artifact.hash}, got ${actualArtifactHash}`,
    };
  }
  for (const [targetName, target] of Object.entries(manifest.artifact.targets)) {
    if (!target) continue;
    for (const requiredFile of target.requiredFiles) {
      if (!fs.existsSync(path.join(showcasePath, SHOWCASE_PRECOMPILED_ROOT, target.root, requiredFile))) {
        return {
          status: 'artifact-invalid',
          reason: `precompiled ${targetName} artifact is missing ${requiredFile}`,
        };
      }
    }
  }
  return { status: 'verified', manifest };
}

function localTarget(showcasePath: string, target: 'desktop' | 'web'): ShowcaseRunTarget {
  const localPath = path.join(showcasePath, SHOWCASE_LOCAL_BUILD_ROOT, target);
  const requiredFiles = target === 'desktop' ? DESKTOP_REQUIRED_FILES : WEB_REQUIRED_FILES;
  const complete = requiredFiles.every(file => fs.existsSync(path.join(localPath, file)));
  return complete
    ? { kind: 'local', path: localPath, reason: 'using local build output' }
    : { kind: 'missing', path: localPath, reason: `local ${target} build is incomplete` };
}

export function resolveShowcaseRunTarget(
  showcasePath: string,
  target: 'desktop' | 'web',
): ShowcaseRunTarget {
  const verification = verifyShowcaseRelease(showcasePath);
  if (verification.status === 'verified' && verification.manifest.artifact.targets[target]) {
    return {
      kind: 'precompiled',
      path: path.join(showcasePath, SHOWCASE_PRECOMPILED_ROOT, target),
      reason: 'source and precompiled artifact hashes match the release manifest',
    };
  }
  const local = localTarget(showcasePath, target);
  if (local.kind === 'local') return local;
  const releaseReason = verification.status === 'verified'
    ? `verified release has no ${target} target`
    : verification.reason;
  return { ...local, reason: `${releaseReason}; ${local.reason}` };
}
