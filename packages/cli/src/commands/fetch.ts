import { resolveShowcaseUrl } from '../registry/resolver.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { emit, log } from '../utils/ndjson.js';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import { execSync, type ExecSyncOptions } from 'child_process';
import {
  writeShowcaseCacheMetadata,
} from '../showcase-cache.js';
import {
  SHOWCASE_LOCAL_BUILD_ROOT,
  verifyShowcaseRelease,
} from '../showcase-release.js';

// execSync with stdio:'pipe' hides stderr, so callers only see
// "Command failed: <cmd>" with no diagnosis. Wrap it to re-throw an Error
// whose message includes captured stderr/stdout.
/**
 * Every install here is spawned by the app, never from a terminal. pnpm asks
 * for confirmation before purging an existing `node_modules` it did not create,
 * and with no TTY to answer it aborts:
 *
 *   ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
 *
 * which surfaced as "showcasePath resolved: null" and a showcase that simply
 * would not run. Declaring the environment non-interactive is what pnpm's own
 * error message asks for.
 */
const NON_INTERACTIVE_ENV = { CI: 'true', npm_config_confirm_modules_purge: 'false' };

/**
 * A fetched source showcase is an independent published package, not a member
 * of the synthesized pnpm workspace. Install it with npm so its devDependencies
 * and their executable shims live in that package's node_modules/.bin.
 *
 * In particular, pnpm's filtered workspace install can link `cross-env` into
 * node_modules without creating node_modules/.bin/cross-env. `npm run build`
 * then fails in production with `cross-env: command not found`, even though the
 * package itself appears installed. `--include=dev` is explicit because the app
 * runs installs non-interactively and must not inherit a user's production-only
 * npm configuration. No lockfile belongs to a fetched cache directory.
 */
const NPM_SOURCE_INSTALL_FLAGS = '--include=dev --no-package-lock --registry=https://registry.npmjs.org/';

function execCapture(command: string, options: ExecSyncOptions = {}): void {
  try {
    execSync(command, {
      stdio: 'pipe',
      ...options,
      env: { ...process.env, ...NON_INTERACTIVE_ENV, ...(options.env ?? {}) },
    });
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() ?? '';
    const stdout = err?.stdout?.toString?.() ?? '';
    const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
    const suffix = detail ? `\n${detail}` : '';
    const wrapped = new Error(`${err?.message ?? 'Command failed'}${suffix}`);
    (wrapped as any).stderr = stderr;
    (wrapped as any).stdout = stdout;
    throw wrapped;
  }
}

function installSourceShowcase(destDir: string, npmCacheDir: string): void {
  execCapture(`npm install ${NPM_SOURCE_INSTALL_FLAGS}`, {
    cwd: destDir,
    timeout: 300000,
    // The host app must not inherit an arbitrary user's npm cache. In
    // particular, a cache previously written with sudo makes npm fail before
    // it installs any dependency. Keep this implementation-owned cache beside
    // the generated workspace instead.
    env: { npm_config_cache: npmCacheDir },
  });
}


export function clearFetchDestination(destDir: string): void {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
}

export async function fetch(url: string, workspaceRoot: string): Promise<void> {
  const resolved = resolveShowcaseUrl(url);
  const manager = new WorkspaceManager(workspaceRoot);
  await manager.init();

  if (resolved.type === 'local' && !fs.existsSync(resolved.filePath)) {
    throw new Error(`Local tarball not found: ${resolved.filePath}`);
  }

  const destination = resolved.type === 'external'
    ? manager.getExternalPath(resolved.name)
    : manager.getShowcasePath(resolved.name);
  clearFetchDestination(destination);

  emit({ type: 'fetch-start', name: resolved.name });

  try {
    if (resolved.type === 'repo') {
      await fetchRepoShowcase(resolved, manager);
    } else if (resolved.type === 'local') {
      await fetchLocalTarball(resolved, manager);
    } else if (resolved.type === 'remote-tarball') {
      await fetchRemoteTarball(resolved, manager);
    } else {
      await fetchExternal(resolved, manager);
    }
    writeShowcaseCacheMetadata(destination, url);
    emit({
      type: 'fetch-success',
      name: resolved.name,
      path: destination,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'fetch-error', name: resolved.name, error: message });
    throw err;
  }
}

// ── Local tarball (file:// protocol) ──────────────────────────────────────

async function fetchLocalTarball(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'local' }>,
  manager: WorkspaceManager
): Promise<void> {
  const { filePath, name } = resolved;

  log(`Extracting local tarball: ${filePath}`);

  const destDir = manager.getShowcasePath(name);
  fs.mkdirSync(destDir, { recursive: true });
  await extractPackedShowcase(filePath, destDir);
  await preparePackedShowcase(name, destDir, manager);
}

async function extractPackedShowcase(filePath: string, destDir: string): Promise<void> {

  // npm pack tarballs have a 'package/' prefix, strip it
  await tar.x({
    file: filePath,
    cwd: destDir,
    strip: 1,
  });
}

async function preparePackedShowcase(
  name: string,
  destDir: string,
  manager: WorkspaceManager,
): Promise<void> {

  // A Release tarball keeps immutable, verified output in dist_precompiled/.
  // dist/ is reserved for a build performed from the extracted/editable source
  // and must never be accepted as proof that the downloaded artifact is valid.
  const release = verifyShowcaseRelease(destDir);
  if (release.status === 'verified') {
    log('Verified release source and precompiled artifact — skipping install');
  } else {
    // Old, incomplete, corrupt, or source-modified packages fall back to the
    // ordinary local source path. Remove any packed dist/ so it cannot be
    // mistaken for a local build produced from this source snapshot.
    fs.rmSync(path.join(destDir, SHOWCASE_LOCAL_BUILD_ROOT), { recursive: true, force: true });
    log(`Precompiled artifact unavailable (${release.reason}) — installing for local build fallback...`);
    try {
      await manager.rewriteWorkspaceRefs(name);
    } catch (_) {}
    emit({ type: 'install-start', name });
    installSourceShowcase(destDir, path.join(manager.getRootPath(), '.npm-cache'));
    emit({ type: 'install-success', name });
  }
}

async function fetchRemoteTarball(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'remote-tarball' }>,
  manager: WorkspaceManager,
): Promise<void> {
  const { url, name } = resolved;
  const destDir = manager.getShowcasePath(name);
  const tmpTar = path.join(manager.getRootPath(), `${name}.download.tgz`);
  fs.mkdirSync(destDir, { recursive: true });

  log(`Downloading packed showcase: ${url}`);
  try {
    await downloadFile(url, tmpTar);
    await extractPackedShowcase(tmpTar, destDir);
    await preparePackedShowcase(name, destDir, manager);
  } finally {
    if (fs.existsSync(tmpTar)) fs.unlinkSync(tmpTar);
  }
}

// ── Remote repo showcase (GitHub tarball API) ─────────────────────────────

async function fetchRepoShowcase(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'repo' }>,
  manager: WorkspaceManager
): Promise<void> {
  const tarballUrl = `https://api.github.com/repos/${resolved.owner}/${resolved.repo}/tarball/${resolved.ref}`;
  const destDir = manager.getShowcasePath(resolved.name);

  log(`Downloading ${resolved.path} from ${resolved.owner}/${resolved.repo}...`);

  const tmpTar = path.join(destDir, '..', `${resolved.name}.tar.gz`);
  fs.mkdirSync(path.dirname(tmpTar), { recursive: true });
  await downloadFile(tarballUrl, tmpTar);

  fs.mkdirSync(destDir, { recursive: true });
  await tar.x({
    file: tmpTar,
    cwd: destDir,
    strip: resolved.path.split('/').length + 1,
    filter: (p: string) => {
      const parts = p.split('/').slice(1);
      return parts.join('/').startsWith(resolved.path + '/') || parts.join('/') === resolved.path;
    },
  });

  fs.unlinkSync(tmpTar);

  await manager.rewriteWorkspaceRefs(resolved.name);

  emit({ type: 'install-start', name: resolved.name });
  installSourceShowcase(destDir, path.join(manager.getRootPath(), '.npm-cache'));
  emit({ type: 'install-success', name: resolved.name });

  // GitHub source tarballs never carry `dist/` (it is gitignored), so build
  // the showcase once so `lynxtron ./dist/desktop` can find main.js.
  const distMain = path.join(destDir, 'dist', 'desktop', 'main.js');
  if (!fs.existsSync(distMain)) {
    log(`Building ${resolved.name}...`);
    execCapture('npm run build', { cwd: destDir });
  }
}

// ── External git repo ─────────────────────────────────────────────────────

async function fetchExternal(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'external' }>,
  manager: WorkspaceManager
): Promise<void> {
  const destDir = manager.getExternalPath(resolved.name);

  log(`Cloning ${resolved.url}...`);
  execCapture(`git clone --depth 1 ${resolved.url} ${destDir}`);

  emit({ type: 'install-start', name: resolved.name });
  installSourceShowcase(destDir, path.join(manager.getRootPath(), '.npm-cache'));
  emit({ type: 'install-success', name: resolved.name });
}

// ── HTTP download helper ──────────────────────────────────────────────────

// TODO: Remove GITHUB_TOKEN/GH_TOKEN auth once repo is public.
function getAuthHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'lynxtron-examples-cli' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const hostname = new URL(url).hostname.toLowerCase();
  if (token && (hostname === 'github.com' || hostname === 'api.github.com')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function downloadFile(url: string, dest: string, redirectsRemaining = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client
      .get(url, { headers: getAuthHeaders(url) }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          response.resume();
          if (redirectsRemaining <= 0) {
            reject(new Error(`Too many redirects while fetching ${url}`));
            return;
          }
          const location = response.headers.location;
          if (!location) {
            reject(new Error(`Redirect missing Location header while fetching ${url}`));
            return;
          }
          downloadFile(new URL(location, url).href, dest, redirectsRemaining - 1).then(resolve, reject);
          return;
        }
        if (response.statusCode && response.statusCode >= 400) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', reject);
      })
      .on('error', reject);
  });
}
