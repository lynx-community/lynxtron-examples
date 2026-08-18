import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MARKER_PREFIX = Buffer.from('LYNXTRON_NATIVE_EXTENSION_V1:', 'ascii');
const MARKER_SUFFIX = Buffer.from(':END_LYNXTRON_NATIVE_EXTENSION', 'ascii');
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const MAX_EXTENSION_FILE_BYTES = 64 * 1024 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;

export interface NativeExtensionFile {
  path: string;
  url: string;
  sha256: string;
}

export interface NativeExtensionManifest {
  schemaVersion: 1;
  name: string;
  platform: string;
  arch: string;
  entry: string;
  files: NativeExtensionFile[];
}

function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || path.posix.isAbsolute(value)) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`${label} may not escape the extension directory`);
  }
  return normalized;
}

export function parseNativeExtensionManifest(value: unknown): NativeExtensionManifest {
  if (!value || typeof value !== 'object') throw new Error('Native extension manifest must be an object');
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1) throw new Error('Unsupported native extension manifest version');
  if (typeof input.name !== 'string' || !/^[a-zA-Z0-9@._/-]+$/.test(input.name)) {
    throw new Error('Native extension manifest has an invalid name');
  }
  if (typeof input.platform !== 'string' || !input.platform) throw new Error('Native extension platform is missing');
  if (typeof input.arch !== 'string' || !input.arch) throw new Error('Native extension architecture is missing');
  const entry = safeRelativePath(input.entry, 'Native extension entry');
  if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > 16) {
    throw new Error('Native extension manifest must contain 1 to 16 files');
  }
  const files = input.files.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Native extension file ${index} is invalid`);
    const file = raw as Record<string, unknown>;
    const filePath = safeRelativePath(file.path, `Native extension file ${index} path`);
    const url = safeRelativePath(file.url, `Native extension file ${index} URL`);
    if (typeof file.sha256 !== 'string' || !SHA256_RE.test(file.sha256)) {
      throw new Error(`Native extension file ${index} has an invalid SHA-256`);
    }
    return { path: filePath, url, sha256: file.sha256 };
  });
  if (!files.some((file) => file.path === entry)) {
    throw new Error('Native extension entry is not listed in files');
  }
  return {
    schemaVersion: 1,
    name: input.name,
    platform: input.platform,
    arch: input.arch,
    entry,
    files,
  };
}

export function extractNativeExtensionManifest(bundle: Buffer): NativeExtensionManifest | null {
  const start = bundle.indexOf(MARKER_PREFIX);
  if (start < 0) return null;
  const payloadStart = start + MARKER_PREFIX.length;
  const end = bundle.indexOf(MARKER_SUFFIX, payloadStart);
  if (end < 0) throw new Error('Native extension declaration is truncated');
  const encoded = bundle.subarray(payloadStart, end).toString('ascii');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Native extension declaration is not valid base64');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new Error('Native extension declaration is not valid JSON');
  }
  return parseNativeExtensionManifest(parsed);
}

async function download(url: URL, maxBytes: number): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Error(`Download exceeds size limit for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`Download exceeds size limit for ${url}`);
  return bytes;
}

export async function inspectRemoteBundle(bundleUrl: string): Promise<NativeExtensionManifest | null> {
  const url = new URL(bundleUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Remote bundle URL must use http or https');
  }
  return extractNativeExtensionManifest(await download(url, MAX_BUNDLE_BYTES));
}

export function nativeExtensionCacheKey(manifest: NativeExtensionManifest): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

export async function downloadNativeExtension(
  manifest: NativeExtensionManifest,
  bundleUrl: string,
  cacheRoot: string,
): Promise<string> {
  if (manifest.platform !== process.platform || manifest.arch !== process.arch) {
    throw new Error(
      `Native extension targets ${manifest.platform}-${manifest.arch}, but this app is ${process.platform}-${process.arch}`,
    );
  }
  const base = new URL(bundleUrl);
  const targetDir = path.join(cacheRoot, nativeExtensionCacheKey(manifest));
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of manifest.files) {
    const remote = new URL(file.url, base);
    if (remote.origin !== base.origin || (remote.protocol !== 'http:' && remote.protocol !== 'https:')) {
      throw new Error(`Native extension file must be served from the bundle origin: ${file.url}`);
    }
    const target = path.join(targetDir, ...file.path.split('/'));
    if (fs.existsSync(target)) {
      const existingHash = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      if (existingHash === file.sha256) continue;
    }
    const bytes = await download(remote, MAX_EXTENSION_FILE_BYTES);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== file.sha256) throw new Error(`SHA-256 mismatch for native extension file ${file.path}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, target);
  }
  return path.join(targetDir, ...manifest.entry.split('/'));
}
