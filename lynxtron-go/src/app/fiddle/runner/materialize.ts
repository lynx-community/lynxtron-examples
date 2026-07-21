import { getExposed, foundationApi } from '../../store';
import { serializeFiddle, type FiddleSnapshot } from '../state/FiddleState';

/**
 * Materialize a fiddle snapshot to `<tmpdir>/lynxtron-fiddle-<n>/dist/desktop/`
 * so it can be handed to `showcaseApi.run()`, which expects that layout.
 * Returns the workspace root (parent of dist/desktop) or null on failure.
 */
export function materializeFiddle(
  snap: FiddleSnapshot,
  liveValues?: Record<string, string>,
): string | null {
  const fs = foundationApi()?.fs;
  if (!fs) return null;

  const tmp = fs.tmpdir?.() ?? '/tmp';
  const uniq = 'lynxtron-fiddle-' + Date.now();
  const workspaceRoot: string = fs.join?.(tmp, uniq) ?? (tmp + '/' + uniq);
  const distDesktop: string = fs.join?.(workspaceRoot, 'dist', 'desktop') ?? (workspaceRoot + '/dist/desktop');

  if (!fs.mkdirp?.(distDesktop)) return null;

  const values = liveValues ?? serializeFiddle(snap);
  for (const [id, content] of Object.entries(values)) {
    const target: string = fs.join?.(distDesktop, id) ?? (distDesktop + '/' + id);
    if (!fs.writeFile?.(target, content)) return null;
  }
  return workspaceRoot;
}
