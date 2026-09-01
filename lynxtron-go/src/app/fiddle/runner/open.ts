import { foundationApi } from '../../store';
import type { FiddleSnapshot } from '../state/FiddleState';
import { loadProjectFiddle } from './showcase-open';

/** Open a complete local Lynx project through the same collector as cases. */
export function loadLocalFiddle(dir: string): FiddleSnapshot | null {
  const fs = foundationApi()?.fs;
  const packagePath = fs?.join?.(dir, 'package.json') ?? `${dir}/package.json`;
  if (!fs?.exists?.(packagePath)) return null;
  const title = fs.basename?.(dir) ?? dir.split('/').pop() ?? 'Local Project';
  return loadProjectFiddle(title, dir, { kind: 'local', ref: dir });
}
