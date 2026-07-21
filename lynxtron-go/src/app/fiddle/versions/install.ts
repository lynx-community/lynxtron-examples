import { getExposed, appendFiddleOutput as appendOutput, foundationApi } from '../../store';

export interface InstallResult {
  ok: boolean;
  installDir: string;
  error?: string;
}

/**
 * Install a Lynxtron runtime version by shelling out to `npm pack` + `tar -xzf`
 * inside a per-version subdirectory of the user home. Returns the target directory
 * on success; the caller can register it as a LocalVersion.
 */
export function installLynxtronVersion(pkg: string, version: string): Promise<InstallResult> {
  return new Promise((resolve) => {
    const fs = foundationApi()?.fs;
    const exec = foundationApi()?.exec;
    if (!fs || !exec) {
      resolve({ ok: false, installDir: '', error: 'Preload bridge not available' });
      return;
    }
    const home = fs.homedir?.() ?? '/tmp';
    const versionDir = fs.join(home, '.lynxtron-fiddle', 'runtimes', `${pkg.replace('/', '__')}@${version}`);
    if (!fs.mkdirp?.(versionDir)) {
      resolve({ ok: false, installDir: versionDir, error: 'mkdir failed' });
      return;
    }

    // Resolve the tarball URL ourselves instead of `npm pack`: downloading
    // with curl streams progress into the console, and a registry whose
    // dist.tarball host needs rewriting (mirrors) can be handled here.
    appendOutput('info', `[VersionInstall] npm view ${pkg}@${version} dist.tarball`);
    let tarballUrl = '';
    const viewHandle = exec.runAsync?.('npm', ['view', `${pkg}@${version}`, 'dist.tarball'], {
      cwd: versionDir,
      onLine: (_stream: string, line: string) => {
        const trimmed = line.trim();
        if (/^https?:\/\//.test(trimmed)) tarballUrl = trimmed;
      },
      onExit: (code: number | null) => {
        if (code !== 0 || !tarballUrl) {
          appendOutput('error', `[VersionInstall] npm view failed code=${code} url=${tarballUrl || 'none'}`);
          resolve({ ok: false, installDir: versionDir, error: `npm view code=${code}` });
          return;
        }
        const fetchUrl = tarballUrl;
        const tarballPath = fs.join(versionDir, 'package.tgz');
        appendOutput('info', `[VersionInstall] curl ${fetchUrl}`);
        exec.runAsync?.('curl', ['-fsSL', '--connect-timeout', '15', '-o', tarballPath, fetchUrl], {
          cwd: versionDir,
          onLine: (_stream: string, line: string) => appendOutput('info', `[curl] ${line}`),
          onExit: (dlCode: number | null) => {
            if (dlCode !== 0) {
              appendOutput('error', `[VersionInstall] download failed code=${dlCode}`);
              resolve({ ok: false, installDir: versionDir, error: `curl code=${dlCode}` });
              return;
            }
            appendOutput('info', `[VersionInstall] tar -xzf package.tgz`);
            exec.runAsync?.('tar', ['-xzf', tarballPath], {
              cwd: versionDir,
              onLine: (_stream: string, line: string) => appendOutput('info', `[tar] ${line}`),
              onExit: (extractCode: number | null) => {
                if (extractCode !== 0) {
                  resolve({ ok: false, installDir: versionDir, error: `tar code=${extractCode}` });
                  return;
                }
                appendOutput('info', `[VersionInstall] ok → ${versionDir}/package`);
                resolve({ ok: true, installDir: fs.join(versionDir, 'package') });
              },
            });
          },
        });
      },
    });
    if (!viewHandle) {
      resolve({ ok: false, installDir: versionDir, error: 'spawn failed' });
    }
  });
}
