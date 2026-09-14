import { foundationApi } from '../../store';

/**
 * Resolve a user-selected local Lynxtron executable. Project classification,
 * build, output validation, process logging and spawning stay in runProject.
 *
 * The installer (see versions/install.ts) unpacks the GitHub release archive
 * flat into `<versionDir>/runtime/`, so the executable sits at that folder's
 * root (win: `lynxtron.exe`, mac: `lynxtron.app/Contents/MacOS/lynxtron`).
 * Older `@lynx-js/lynxtron` package layouts that placed the binary under
 * `dist/<variant>/` are still accepted as a fallback.
 */
export function resolveLocalRuntimeExecutable(localVersionFolder: string | null): string | null {
  if (!localVersionFolder) return null;
  const fs = foundationApi()?.fs;
  if (!fs) throw new Error('Preload bridge unavailable');
  const platform: string = foundationApi()?.platform ?? 'darwin';

  const executableRelPath = platform === 'win32'
    ? ['lynxtron.exe']
    : ['lynxtron.app', 'Contents', 'MacOS', 'lynxtron'];

  const roots = [
    localVersionFolder,
    fs.join(localVersionFolder, 'dist', 'devtool'),
    fs.join(localVersionFolder, 'dist', 'release'),
    fs.join(localVersionFolder, 'dist'),
  ];
  const candidates = roots.map((root: string) => fs.join(root, ...executableRelPath));
  const executable = candidates.find((candidate: string) => fs.exists?.(candidate));
  if (!executable) throw new Error(`Lynxtron executable not found under ${localVersionFolder}`);
  return executable;
}
