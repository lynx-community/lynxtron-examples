import { getExposed, foundationApi } from '../../store';
import { isSafeRelativePath } from '../state/FiddleState';
import { serializeFiddle, type FiddleSnapshot } from '../state/FiddleState';

export function pickSaveFolder(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      // @ts-ignore — NativeModules.bridge is provided by the preload layer
      NativeModules.bridge.call('saveFolder', {}, (result: any) => {
        resolve(result?.path ?? null);
      });
    } catch (_) { resolve(null); }
  });
}

export function writeFiddleToFolder(
  snap: FiddleSnapshot,
  dir: string,
  liveValues?: Record<string, string>,
): boolean {
  const fs = foundationApi()?.fs;
  if (!fs) return false;
  const values = liveValues ?? serializeFiddle(snap);
  for (const [id, content] of Object.entries(values)) {
    if (!isSafeRelativePath(id)) continue; // traversal guard
    const target: string = fs.join?.(dir, id) ?? (dir + '/' + id);
    if (!fs.writeFile?.(target, content)) return false;
  }
  return true;
}
