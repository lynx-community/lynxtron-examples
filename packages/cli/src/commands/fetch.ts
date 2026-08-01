import { resolveShowcaseUrl } from '../registry/resolver.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { emit, log } from '../utils/ndjson.js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import { execSync, type ExecSyncOptions } from 'child_process';

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
 * `CI: 'true'` above also makes pnpm default `frozen-lockfile` to true, which
 * we must undo. The workspace being installed into is synthesized under
 * ~/.lynxtron-go: its manifests are rewritten from the current catalog on every
 * fetch, while its lockfile is a cache left by whatever was fetched last. The
 * moment the catalog moves the two disagree and every fetch dies with
 * ERR_PNPM_OUTDATED_LOCKFILE, so the showcase never installs and the window
 * that asked for it sits on the Fiddle forever.
 *
 * The inverse of a repo CI install: there the lockfile is the source of truth
 * and must not drift; here it is a cache that has to follow the manifests.
 *
 * It has to be a flag. pnpm does not read `npm_config_frozen_lockfile` from the
 * environment — setting it changes nothing, verified against pnpm 10.15.1.
 */
const INSTALL_FLAGS = '--no-frozen-lockfile';

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

  emit({ type: 'fetch-start', name: resolved.name });

  try {
    if (resolved.type === 'repo') {
      await fetchRepoShowcase(resolved, manager);
    } else if (resolved.type === 'local') {
      await fetchLocalTarball(resolved, manager);
    } else {
      await fetchExternal(resolved, manager);
    }
    emit({
      type: 'fetch-success',
      name: resolved.name,
      path:
        resolved.type === 'external'
          ? manager.getExternalPath(resolved.name)
          : manager.getShowcasePath(resolved.name),
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

  if (!fs.existsSync(filePath)) {
    throw new Error(`Local tarball not found: ${filePath}`);
  }

  log(`Extracting local tarball: ${filePath}`);

  const destDir = manager.getShowcasePath(name);
  clearFetchDestination(destDir);
  fs.mkdirSync(destDir, { recursive: true });

  // npm pack tarballs have a 'package/' prefix, strip it
  await tar.x({
    file: filePath,
    cwd: destDir,
    strip: 1,
  });

  // Local tarballs from npm pack contain built dist/ — no install needed.
  // If the tarball has dist/desktop/main.js, it's ready to run directly.
  const hasBuiltDist = fs.existsSync(path.join(destDir, 'dist', 'desktop', 'main.js'));
  if (hasBuiltDist) {
    log(`Built dist found — skipping install (ready to run)`);
  } else {
    // Source-only tarball — needs install + build
    log(`No built dist — running pnpm install...`);
    try {
      await manager.rewriteWorkspaceRefs(name);
    } catch (_) {}
    emit({ type: 'install-start', name });
    // Scope install to just this showcase so other workspace members
    // (previously-fetched showcases) don't run their postinstall scripts.
    execCapture(`pnpm install ${INSTALL_FLAGS} --filter=./showcases/${name}...`, {
      cwd: manager.getRootPath(),
      timeout: 300000,
    });
    emit({ type: 'install-success', name });
  }
}

// ── Remote repo showcase (GitHub tarball API) ─────────────────────────────

async function fetchRepoShowcase(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'repo' }>,
  manager: WorkspaceManager
): Promise<void> {
  const tarballUrl = `https://api.github.com/repos/${resolved.owner}/${resolved.repo}/tarball/${resolved.ref}`;
  const destDir = manager.getShowcasePath(resolved.name);
  clearFetchDestination(destDir);

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
  execCapture(
    `pnpm install ${INSTALL_FLAGS} --filter=./showcases/${resolved.name}... --registry=https://registry.npmjs.org/`,
    {
      cwd: manager.getRootPath(),
    }
  );
  emit({ type: 'install-success', name: resolved.name });

  // GitHub source tarballs never carry `dist/` (it is gitignored), so build
  // the showcase once so `lynxtron ./dist/desktop` can find main.js.
  const distMain = path.join(destDir, 'dist', 'desktop', 'main.js');
  if (!fs.existsSync(distMain)) {
    log(`Building ${resolved.name}...`);
    execCapture('pnpm run build', { cwd: destDir });
  }
}

// ── External git repo ─────────────────────────────────────────────────────

async function fetchExternal(
  resolved: Extract<ReturnType<typeof resolveShowcaseUrl>, { type: 'external' }>,
  manager: WorkspaceManager
): Promise<void> {
  const destDir = manager.getExternalPath(resolved.name);
  clearFetchDestination(destDir);

  log(`Cloning ${resolved.url}...`);
  execCapture(`git clone --depth 1 ${resolved.url} ${destDir}`);

  emit({ type: 'install-start', name: resolved.name });
  execCapture(`pnpm install ${INSTALL_FLAGS}`, { cwd: destDir });
  emit({ type: 'install-success', name: resolved.name });
}

// ── HTTP download helper ──────────────────────────────────────────────────

// TODO: Remove GITHUB_TOKEN/GH_TOKEN auth once repo is public.
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'lynxtron-examples-cli' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: getAuthHeaders() }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          downloadFile(response.headers.location!, dest).then(resolve, reject);
          return;
        }
        if (response.statusCode && response.statusCode >= 400) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', reject);
  });
}
