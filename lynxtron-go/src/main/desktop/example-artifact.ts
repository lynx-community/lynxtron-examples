import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import {
  EXAMPLE_ARTIFACT_BASE_URL,
  buildExampleArtifactFileUrl,
  buildExampleArtifactMetadataUrl,
  collectExampleArtifactDownloadTargets,
  normalizeExampleArtifactInput,
  type ExampleArtifactFetchResult,
  validateExampleArtifactMetadata,
} from '../../app/shared/example-artifact';
import { DEBUG_LOG } from './preload-log';
import { resolveLynxtronExecutablePath, resolveLynxtronPackageEntryPath } from './preload-lynxtron-runtime';
const activeExampleCacheDirs = new Set<string>();
const activeExampleLaunchers = new Map<number, ChildProcess>();
let runtimeEnvironmentLogged = false;

function dbg(msg: string) {
  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] [ExampleArtifact] ${msg}\n`);
  } catch (_) {}
}

function formatDownloadError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message || String(error);
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    const stack = (error as { stack?: unknown }).stack;
    if (typeof stack === 'string' && stack) return stack;
    if (typeof message === 'string' && message) return message;
  }
  return String(error);
}

function logDownloadFailure(
  stage: 'metadata' | 'file',
  url: string,
  detail: {
    exampleId?: string;
    relativePath?: string;
    status?: number;
    error?: string;
    stack?: string;
  },
) {
  const parts = [
    `download failure stage=${stage}`,
    `url=${url}`,
    detail.exampleId ? `exampleId=${detail.exampleId}` : null,
    detail.relativePath ? `relativePath=${detail.relativePath}` : null,
    typeof detail.status === 'number' ? `status=${detail.status}` : null,
    detail.error ? `error=${detail.error}` : null,
    detail.stack ? `stack=${detail.stack}` : null,
  ].filter(Boolean);
  dbg(parts.join(' '));
}

function logRuntimeEnvironmentOnce() {
  if (runtimeEnvironmentLogged) return;
  runtimeEnvironmentLogged = true;
  dbg([
    'runtime env',
    `process.version=${process.version}`,
    `node=${process.versions.node}`,
    `v8=${process.versions.v8}`,
    `uv=${process.versions.uv}`,
    `openssl=${process.versions.openssl}`,
  ].join(' '));
}

function clearExampleArtifactCaches() {
  for (const dir of activeExampleCacheDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {}
  }
  activeExampleCacheDirs.clear();
}

function createExampleCacheDir(): string {
  const prefix = path.join(os.tmpdir(), 'lynxtron-example-');
  const cachePath = fs.mkdtempSync(prefix);
  activeExampleCacheDirs.add(cachePath);
  return cachePath;
}

function removeExampleCacheDir(cachePath: string) {
  try {
    fs.rmSync(cachePath, { recursive: true, force: true });
  } catch (_) {}
  activeExampleCacheDirs.delete(cachePath);
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function relativePathToLocalPath(cachePath: string, relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean);
  return path.join(cachePath, ...segments);
}

function getLynxtronExecutableRelativePath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join('lynxtron.app', 'Contents', 'MacOS', 'lynxtron');
    case 'win32':
      return path.join('lynxtron', 'lynxtron.exe');
    default:
      throw new Error(`Unsupported Lynxtron platform: ${process.platform}`);
  }
}

function resolveLynxtronBin(): string {
  const nativeRequire = typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__ as NodeRequire
    : require;
  const executableRelativePath = getLynxtronExecutableRelativePath();
  const localRoot = process.env.LYNXTRON_LOCAL_ROOT;
  if (localRoot) {
    const localExecutablePath = path.join(
      localRoot,
      'src',
      'packages',
      'lynxtron',
      'dist',
      process.platform,
      process.arch,
      executableRelativePath,
    );
    if (fs.existsSync(localExecutablePath)) {
      return localExecutablePath;
    }
    dbg(`resolveLynxtronBin: local executable not found at ${localExecutablePath}, falling back to installed package`);
  }

  const mainPath = nativeRequire.resolve('@lynx-js/lynxtron');
  // 从 main 路径向上查找 package.json 来确定包根目录
  let currentDir = path.dirname(mainPath);
  while (currentDir !== path.dirname(currentDir)) { // 直到到达文件系统根目录
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return path.join(
        currentDir,
        'dist',
        process.platform,
        process.arch,
        executableRelativePath,
      );
    }
    currentDir = path.dirname(currentDir);
  }
  // 如果找不到 package.json，回到原始方案
  return path.join(
    path.dirname(mainPath),
    'dist',
    process.platform,
    process.arch,
    executableRelativePath,
  );
}

type DownloadResult =
  | { ok: true; status: number; response: { text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer>; headers: { get(name: string): string | null } } }
  | { ok: false; status: number; error: string; stack?: string };

type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  redirect?: 'manual' | 'follow' | 'error';
}) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

let fetchImplPromise: Promise<FetchLike> | null = null;

async function getFetchImpl(): Promise<FetchLike> {
  if (!fetchImplPromise) {
    const fetchImpl = (globalThis as typeof globalThis & { fetch?: FetchLike }).fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('globalThis.fetch is unavailable in current runtime');
    }
    fetchImplPromise = Promise.resolve(fetchImpl);
  }
  return fetchImplPromise;
}

async function downloadFetchResource(url: string, redirectCount = 0): Promise<DownloadResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      error: error?.message || String(error),
      stack: formatDownloadError(error),
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      status: 0,
      error: `Unsupported protocol: ${parsed.protocol}`,
    };
  }

  try {
    const fetchImpl = await getFetchImpl();
    const response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      headers: {
        Accept: '*/*',
        'User-Agent': 'lynxtron-go-example-artifact',
      },
      redirect: 'manual',
    });

    const status = response.status ?? 0;
    const location = response.headers.get('location');
    if (status >= 300 && status < 400 && location) {
      if (redirectCount >= 5) {
        return { ok: false, status, error: `Too many redirects while fetching ${url}` };
      }
      return downloadFetchResource(new URL(location, parsed).toString(), redirectCount + 1);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      return { ok: false, status, error: bodyText.trim() || `HTTP ${status}` };
    }

    return { ok: true, status, response };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      error: error?.message || String(error),
      stack: formatDownloadError(error),
    };
  }
}

export interface ExampleArtifactRunLauncher {
  launcherRoot: string;
  distDesktop: string;
  bundlePath: string;
  title: string;
}

export function prepareExampleArtifactRunLauncher(
  cachePath: string,
  templateFile: string,
  title?: string,
): ExampleArtifactRunLauncher {
  const launcherRoot = path.join(cachePath, '.lynxtron-launcher');
  const distDesktop = path.join(launcherRoot, 'dist', 'desktop');
  const bundlePath = relativePathToLocalPath(cachePath, templateFile);
  const windowTitle = title?.trim() || 'Example Artifact Preview';
  const lynxtronPackageEntry = resolveLynxtronPackageEntryPath(dbg);

  fs.mkdirSync(distDesktop, { recursive: true });
  fs.writeFileSync(
    path.join(launcherRoot, 'package.json'),
    JSON.stringify({ name: 'lynxtron-example-artifact-runner', private: true }, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(distDesktop, 'package.json'),
    JSON.stringify({ name: 'lynxtron-example-artifact-runner', private: true, main: 'main.js' }, null, 2),
    'utf-8',
  );

  const mainJs = [
    "const path = require('path');",
    `const { app, LynxWindow } = require(${JSON.stringify(lynxtronPackageEntry)});`,
    `const BUNDLE_PATH = ${JSON.stringify(bundlePath)};`,
    `const WINDOW_TITLE = ${JSON.stringify(windowTitle)};`,
    '',
    "console.log('[ExampleArtifact] launcher starting:', WINDOW_TITLE);",
    'app.whenReady().then(() => {',
    '  const win = new LynxWindow({',
    '    width: 1120,',
    '    height: 780,',
    '    title: WINDOW_TITLE,',
    '  });',
    "  console.log('[ExampleArtifact] LynxWindow created');",
    '  win.show();',
    '  if (!win.loadFile(BUNDLE_PATH)) {',
    "    console.error('[ExampleArtifact] Failed to load Lynx bundle:', BUNDLE_PATH);",
    '  } else {',
    "    console.log('[ExampleArtifact] loadFile invoked:', BUNDLE_PATH);",
    '  }',
    '});',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(distDesktop, 'main.js'), mainJs, 'utf-8');
  return {
    launcherRoot,
    distDesktop,
    bundlePath,
    title: windowTitle,
  };
}

export function runExampleArtifact(
  cachePath: string,
  templateFile: string,
  title?: string,
): number {
  logRuntimeEnvironmentOnce();
  const { distDesktop, bundlePath, title: windowTitle } = prepareExampleArtifactRunLauncher(
    cachePath,
    templateFile,
    title,
  );

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Example bundle not found: ${templateFile}`);
  }

  const lynxtronBin = resolveLynxtronExecutablePath(dbg);
  dbg(`exampleArtifact.run: lynxtronBin=${lynxtronBin} distDesktop=${distDesktop} bundlePath=${bundlePath} title=${windowTitle}`);
  const child = spawn(lynxtronBin, [distDesktop], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env },
  });
  const pid = child.pid ?? 0;
  child.stdout?.on('data', (d: Buffer) => {
    dbg(`[ExampleArtifact:out] ${d.toString().trimEnd()}`);
  });
  child.stderr?.on('data', (d: Buffer) => {
    dbg(`[ExampleArtifact:err] ${d.toString().trimEnd()}`);
  });
  activeExampleLaunchers.set(pid, child);
  child.on('error', (error) => {
    dbg(`exampleArtifact.run: pid=${pid} error=${error.message}`);
    activeExampleLaunchers.delete(pid);
  });
  child.on('close', (code) => {
    dbg(`exampleArtifact.run: pid=${pid} exited code=${code}`);
    activeExampleLaunchers.delete(pid);
  });
  child.unref();
  return pid;
}

async function downloadText(url: string): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string; stack?: string }> {
  try {
    if (url.startsWith('file://')) {
      return { ok: true, text: fs.readFileSync(fileURLToPath(url), 'utf-8') };
    }
    const response = await downloadFetchResource(url);
    if (!response.ok) {
      return { ok: false, status: response.status, error: response.error, stack: response.stack };
    }
    return { ok: true, text: await response.response.text() };
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.message || String(error), stack: formatDownloadError(error) };
  }
}

async function downloadBytes(url: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; status: number; error: string; stack?: string }> {
  try {
    if (url.startsWith('file://')) {
      return { ok: true, bytes: new Uint8Array(fs.readFileSync(fileURLToPath(url))) };
    }
    const response = await downloadFetchResource(url);
    if (!response.ok) {
      return { ok: false, status: response.status, error: response.error, stack: response.stack };
    }
    return { ok: true, bytes: new Uint8Array(await response.response.arrayBuffer()) };
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.message || String(error), stack: formatDownloadError(error) };
  }
}

async function writeFetchedFile(
  cachePath: string,
  relativePath: string,
  url: string,
): Promise<{ ok: true; localPath: string } | { ok: false; status: number; error: string; stack?: string }> {
  const result = await downloadBytes(url);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error, stack: result.stack };
  }
  const localPath = relativePathToLocalPath(cachePath, relativePath);
  try {
    ensureParentDir(localPath);
    fs.writeFileSync(localPath, Buffer.from(result.bytes));
    return { ok: true, localPath };
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.message || String(error) };
  }
}

export async function fetchExampleArtifact(
  relativePath: string,
  baseUrl: string = EXAMPLE_ARTIFACT_BASE_URL,
): Promise<ExampleArtifactFetchResult> {
  logRuntimeEnvironmentOnce();
  const normalizedInput = normalizeExampleArtifactInput(relativePath);
  if (!normalizedInput.ok) return normalizedInput;

  // Re-pull each time: clear any prior temporary caches before creating a new one.
  clearExampleArtifactCaches();

  const exampleId = normalizedInput.value;
  const cachePath = createExampleCacheDir();
  const metadataUrl = buildExampleArtifactMetadataUrl(exampleId, baseUrl);
  const metadataPath = relativePathToLocalPath(cachePath, 'example-metadata.json');

  const metadataResponse = await downloadText(metadataUrl);
  if (!metadataResponse.ok) {
    logDownloadFailure('metadata', metadataUrl, {
      exampleId,
      status: metadataResponse.status,
      error: metadataResponse.error,
      stack: metadataResponse.stack,
    });
    removeExampleCacheDir(cachePath);
    const code = metadataResponse.status === 404 ? 'METADATA_NOT_FOUND' : 'NETWORK_ERROR';
    return {
      ok: false,
      error: {
        code,
        message: code === 'METADATA_NOT_FOUND'
          ? `example-metadata.json was not found for "${exampleId}"`
          : `Failed to fetch example metadata for "${exampleId}"`,
        detail: metadataResponse.error,
      },
    };
  }

  try {
    ensureParentDir(metadataPath);
    fs.writeFileSync(metadataPath, metadataResponse.text, 'utf-8');
  } catch (error: any) {
    removeExampleCacheDir(cachePath);
    return {
      ok: false,
      error: {
        code: 'CACHE_WRITE_FAILED',
        message: `Failed to write metadata cache for "${exampleId}"`,
        detail: error?.message || String(error),
      },
    };
  }

  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(metadataResponse.text);
  } catch (error: any) {
    removeExampleCacheDir(cachePath);
    return {
      ok: false,
      error: {
        code: 'INVALID_METADATA',
        message: `example-metadata.json for "${exampleId}" is not valid JSON`,
        detail: error?.message || String(error),
      },
    };
  }

  const validated = validateExampleArtifactMetadata(rawMetadata);
  if (!validated.ok) {
    removeExampleCacheDir(cachePath);
    return validated;
  }

  const metadata = validated.metadata;
  const downloadedFiles: Array<{ relativePath: string; localPath: string; kind: 'metadata' | 'file' | 'template' | 'webFile' | 'previewImage' }> = [
    {
      relativePath: 'example-metadata.json',
      localPath: metadataPath,
      kind: 'metadata',
    },
  ];

  const targets = collectExampleArtifactDownloadTargets(metadata)
    .filter(target => target.relativePath !== 'example-metadata.json');

  for (const target of targets) {
    const url = buildExampleArtifactFileUrl(exampleId, target.relativePath, baseUrl);
    const result = await writeFetchedFile(cachePath, target.relativePath, url);
    if (!result.ok) {
      logDownloadFailure('file', url, {
        exampleId,
        relativePath: target.relativePath,
        status: result.status,
        error: result.error,
        stack: result.stack,
      });
      removeExampleCacheDir(cachePath);
      return {
        ok: false,
        error: {
          code: result.status === 404 ? 'DOWNLOAD_FAILED' : 'NETWORK_ERROR',
          message: `Failed to fetch "${target.relativePath}" for "${exampleId}"`,
          detail: result.error,
        },
      };
    }
    downloadedFiles.push({
      relativePath: target.relativePath,
      localPath: result.localPath,
      kind: target.kind,
    });
  }

  return {
    ok: true,
    exampleId,
    metadataUrl,
    cachePath,
    metadataPath,
    metadata,
    downloadedFiles,
  };
}

process.on('exit', () => {
  clearExampleArtifactCaches();
  for (const [, child] of activeExampleLaunchers) {
    try { child.kill(); } catch (_) {}
  }
  activeExampleLaunchers.clear();
});
