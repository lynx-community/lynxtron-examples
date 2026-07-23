import { showcaseApi, foundationApi, SHOWCASE_LOCAL_WORKSPACE, type ShowcaseEntry } from '../../store';
import { detectLanguage } from '../../syntax';
import { isSafeRelativePath, type FiddleSnapshot, type FiddleFile, type EditorId } from '../state/FiddleState';
import { collectWorkspaceTextFiles } from './workspace-files';

// Opening a showcase in the Fiddle = Electron Fiddle's "load from the web":
// download/extract the package to a workspace, surface its source files in
// the editor mosaic, and let Run execute the workspace.
const DEFAULT_PANE_FILE = /\.(cjs|mjs|js|jsx|ts|tsx|css|scss|less|json|html)$/i;

/** Download (or locally resolve) a showcase's workspace folder. */
export async function resolveShowcaseWorkspace(entry: ShowcaseEntry): Promise<string | null> {
  try {
    if (SHOWCASE_LOCAL_WORKSPACE && entry.path) {
      const local = showcaseApi()?.resolveRegistryPath?.(entry.path);
      if (local) return local;
    }
  } catch (_) {}
  if (!entry.url) return null;
  const fetchFn = showcaseApi()?.fetch;
  if (typeof fetchFn !== 'function') return null;
  const workspace = await fetchFn(entry.url);
  return workspace || null;
}

/** Collect the showcase's complete editable source tree into a snapshot. */
export function loadShowcaseFiddle(entry: ShowcaseEntry, workspaceRoot: string): FiddleSnapshot | null {
  const fs = foundationApi()?.fs;
  if (!fs) return null;

  const collected = collectWorkspaceTextFiles(fs, workspaceRoot);

  if (collected.length === 0) return null;

  const files = new Map<EditorId, FiddleFile>();
  let visibleBudget = 4;
  for (const f of collected) {
    const isMeta = f.rel === 'package.json' || f.rel.endsWith('.config.js') || f.rel.endsWith('.config.ts');
    // Documentation/config assets belong in the complete tree but should not
    // displace the primary code panes when a showcase first opens.
    const visible = !isMeta
      && DEFAULT_PANE_FILE.test(f.rel)
      && f.content.length > 0
      && visibleBudget > 0;
    if (visible) visibleBudget -= 1;
    files.set(f.rel, {
      id: f.rel,
      savedContent: f.content,
      currentText: f.content,
      language: detectLanguage(f.rel),
      isDirty: false,
      visible,
    });
  }

  return {
    source: { kind: 'showcase', ref: workspaceRoot },
    files,
    activeEditorId: collected[0]?.rel ?? null,
    title: entry.name,
  };
}

/** Write (possibly edited) fiddle contents back into the workspace before running.
    Unchanged files are skipped — writing them anyway would bump every mtime and
    defeat the source-newer-than-build check that decides rebuild vs direct run. */
export function writeFiddleToWorkspace(workspaceRoot: string, values: Record<string, string>): boolean {
  const fs = foundationApi()?.fs;
  if (!fs) return false;
  for (const [rel, content] of Object.entries(values)) {
    if (!isSafeRelativePath(rel)) continue; // traversal guard: never leave the workspace
    const target: string = fs.join?.(workspaceRoot, rel) ?? workspaceRoot + '/' + rel;
    try {
      let onDisk: string | null = null;
      try { onDisk = fs.readFile?.(target) ?? null; } catch (_) { onDisk = null; }
      if (onDisk === content) continue;
      if (!fs.writeFile?.(target, content)) return false;
    } catch (_) { return false; }
  }
  return true;
}
