import { appendFiddleOutput as appendOutput, foundationApi } from '../../store';

export interface InstallResult {
  ok: boolean;
  installDir: string;
  error?: string;
}

interface ExecOutcome {
  code: number | null;
  error?: Error;
}

/**
 * Promisify the callback-based exec.runAsync bridge. A spawn failure surfaces
 * through onError (see preload-foundation-service); we fold it into the same
 * resolved outcome so callers branch on one shape instead of nesting handlers.
 */
function runCommand(
  exec: any,
  cmd: string,
  args: string[],
  opts: { cwd?: string; onLine?: (line: string) => void } = {},
): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    const handle = exec.runAsync?.(cmd, args, {
      cwd: opts.cwd,
      onLine: (_stream: string, line: string) => opts.onLine?.(line),
      onError: (err: Error) => resolve({ code: null, error: err }),
      onExit: (code: number | null) => resolve({ code }),
    });
    if (!handle) resolve({ code: null, error: new Error(`spawn ${cmd} failed`) });
  });
}

/**
 * A Lynxtron runtime is a self-contained binary archive on GitHub releases —
 * not the `@lynx-js/lynxtron` npm package (that is only a launcher: its tarball
 * ships cli.js + runtime-manager.js and no platform binary). We download the
 * platform archive directly and unpack it. The archive is flat: the executable
 * (win: `lynxtron.exe`, mac: `lynxtron.app`) sits at the extraction root next
 * to its `resources/` and `devtool_resources/` folders.
 *
 *   https://github.com/lynx-family/lynxtron/releases/download/
 *     v<version>/lynxtron-v<version>-<platform>-<arch>-devtool.zip
 */
const RUNTIME_VARIANT = 'devtool';
const RUNTIME_BASE_URL = 'https://github.com/lynx-family/lynxtron/releases/download';

function runtimeArtifactUrl(version: string, platform: string, arch: string): string {
  const variantPart = RUNTIME_VARIANT === 'devtool' ? '-devtool' : '';
  const filename = `lynxtron-v${version}-${platform}-${arch}${variantPart}.zip`;
  return `${RUNTIME_BASE_URL}/v${version}/${filename}`;
}

function runtimeExecutableRelPath(platform: string): string[] {
  // At the flat extraction root of the release archive.
  if (platform === 'win32') return ['lynxtron.exe'];
  if (platform === 'darwin') return ['lynxtron.app', 'Contents', 'MacOS', 'lynxtron'];
  return ['lynxtron'];
}

/**
 * Install a Lynxtron runtime version: download the matching platform release
 * archive and unpack it into `<versionDir>/runtime/`. Returns that runtime dir
 * on success; the caller registers it as a LocalVersion and spawnRuntime
 * resolves the executable at its root.
 */
export function installLynxtronVersion(pkg: string, version: string): Promise<InstallResult> {
  return new Promise((resolve) => {
    void (async () => {
      const fs = foundationApi()?.fs;
      const exec = foundationApi()?.exec;
      const platform: string = foundationApi()?.platform ?? 'darwin';
      const arch: string = foundationApi()?.arch ?? 'x64';
      if (!fs || !exec) {
        resolve({ ok: false, installDir: '', error: 'Preload bridge not available' });
        return;
      }
      const home = fs.homedir?.() ?? '/tmp';
      const versionDir = fs.join(home, '.lynxtron-fiddle', 'runtimes', `${pkg.replace('/', '__')}@${version}`);
      const runtimeDir = fs.join(versionDir, 'runtime');
      const fail = (error: string): void => resolve({ ok: false, installDir: runtimeDir, error });
      if (!fs.mkdirp?.(runtimeDir)) {
        resolve({ ok: false, installDir: runtimeDir, error: 'mkdir failed' });
        return;
      }

      // 1. Download the platform runtime archive from GitHub releases. curl's
      // -L is essential: the release URL 302s to a signed object store host.
      const runtimeUrl = runtimeArtifactUrl(version, platform, arch);
      const runtimeZip = fs.join(versionDir, 'runtime.zip');
      appendOutput('info', `[VersionInstall] curl ${runtimeUrl}`);
      const dl = await runCommand(exec, 'curl', ['-fsSL', '--connect-timeout', '15', '-o', runtimeZip, runtimeUrl], {
        cwd: versionDir,
        onLine: (line) => appendOutput('info', `[curl] ${line}`),
      });
      if (dl.error) {
        appendOutput('error', `[VersionInstall] curl not runnable: ${dl.error.message}`);
        return fail(`curl unavailable: ${dl.error.message}`);
      }
      if (dl.code !== 0) {
        appendOutput('error', `[VersionInstall] runtime download failed code=${dl.code} url=${runtimeUrl}`);
        return fail(`runtime download code=${dl.code} (${platform}-${arch})`);
      }

      // 2. Unpack the archive into runtime/. On Windows the bundled bsdtar reads
      // .zip; on macOS `unzip` preserves the .app bundle's symlinks and exec
      // bits (tar/libarchive is less reliable for app bundles there).
      const [tool, toolArgs]: [string, string[]] = platform === 'win32'
        ? ['tar', ['-xf', runtimeZip, '-C', runtimeDir]]
        : ['unzip', ['-o', '-q', runtimeZip, '-d', runtimeDir]];
      appendOutput('info', `[VersionInstall] ${tool} → runtime/`);
      const unpack = await runCommand(exec, tool, toolArgs, {
        cwd: versionDir,
        onLine: (line) => appendOutput('info', `[${tool}] ${line}`),
      });
      if (unpack.error) {
        appendOutput('error', `[VersionInstall] ${tool} not runnable: ${unpack.error.message}`);
        return fail(`${tool} unavailable: ${unpack.error.message}`);
      }
      if (unpack.code !== 0) return fail(`runtime unzip code=${unpack.code}`);

      // 3. Confirm the executable actually landed before reporting success.
      const executable = fs.join(runtimeDir, ...runtimeExecutableRelPath(platform));
      if (!fs.exists?.(executable)) {
        appendOutput('error', `[VersionInstall] runtime executable missing after unzip: ${executable}`);
        return fail(`runtime executable missing: ${executable}`);
      }

      appendOutput('info', `[VersionInstall] ok → ${executable}`);
      resolve({ ok: true, installDir: runtimeDir });
    })();
  });
}
