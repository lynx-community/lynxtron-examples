import { foundationApi } from '../../store';

/**
 * Resolve a user-selected local Lynxtron executable. Project classification,
 * build, output validation, process logging and spawning stay in runProject.
 */
export function resolveLocalRuntimeExecutable(localVersionFolder: string | null): string | null {
  if (!localVersionFolder) return null;
  const fs = foundationApi()?.fs;
  if (!fs) throw new Error('Preload bridge unavailable');
  const candidates = [
    fs.join(localVersionFolder, 'dist', 'lynxtron.app', 'Contents', 'MacOS', 'lynxtron'),
    fs.join(localVersionFolder, 'lynxtron.app', 'Contents', 'MacOS', 'lynxtron'),
  ];
  const executable = candidates.find((candidate: string) => fs.exists?.(candidate));
  if (!executable) throw new Error(`Lynxtron executable not found under ${localVersionFolder}`);
  return executable;
}
