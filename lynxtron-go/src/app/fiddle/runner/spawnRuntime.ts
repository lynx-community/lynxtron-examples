import { getExposed, showcaseApi, appendFiddleOutput as appendOutput, foundationApi } from '../../store';

export interface SpawnRuntimeResult {
  ok: boolean;
  pid: number | null;
  error?: string;
}

/**
 * Spawn Lynxtron for `<workspace>/dist/desktop` — if `localVersionFolder` is set,
 * shell out to that folder's `lynxtron.app/Contents/MacOS/lynxtron` via foundation.exec.
 * Otherwise fall back to the bundled runtime via `showcaseApi.run`.
 */
export function spawnRuntimeForWorkspace(
  workspace: string,
  localVersionFolder: string | null,
): SpawnRuntimeResult {
  if (localVersionFolder) {
    const fs = foundationApi()?.fs;
    const exec = foundationApi()?.exec;
    if (!fs || !exec) return { ok: false, pid: null, error: 'Preload bridge unavailable' };
    const executable = fs.join(localVersionFolder, 'dist', 'lynxtron.app', 'Contents', 'MacOS', 'lynxtron');
    if (!fs.exists?.(executable)) {
      const fallback = fs.join(localVersionFolder, 'lynxtron.app', 'Contents', 'MacOS', 'lynxtron');
      if (!fs.exists?.(fallback)) {
        return { ok: false, pid: null, error: `Executable not found at ${executable}` };
      }
    }
    const distDesktop = fs.join(workspace, 'dist', 'desktop');
    const handle = exec.runAsync?.(executable, [distDesktop], {
      env: { LYNXTRON_ALLOW_MULTI: '1' },
      onLine: (stream: string, line: string) => {
        appendOutput(stream === 'stderr' ? 'error' : 'info', line);
      },
      onExit: (code: number | null) => {
        appendOutput('info', `[LocalRuntime] exit code=${code}`);
      },
    });
    return { ok: !!handle?.pid, pid: handle?.pid ?? null };
  }

  try {
    const pid = showcaseApi()?.run?.(workspace);
    return { ok: typeof pid === 'number' && pid > 0, pid: pid ?? null };
  } catch (e: any) {
    return { ok: false, pid: null, error: e?.message ?? String(e) };
  }
}
