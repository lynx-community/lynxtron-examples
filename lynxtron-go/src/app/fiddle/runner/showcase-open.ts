import { showcaseApi, foundationApi, SHOWCASE_LOCAL_WORKSPACE, type ShowcaseEntry } from '../../store';
import { detectLanguage } from '../../syntax';
import { isSafeRelativePath, type FiddleSnapshot, type FiddleFile, type EditorId } from '../state/FiddleState';

// Opening a showcase in the Fiddle = Electron Fiddle's "load from the web":
// download/extract the package to a workspace, surface its source files in
// the editor mosaic, and let Run execute the workspace.

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

const CODE_FILE = /\.(cjs|mjs|js|jsx|ts|tsx|css|scss|less|json|html)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'output', 'build', '.git', '.rspeedy', 'coverage']);
const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'tsconfig.tsbuildinfo']);
const MAX_FILES = 14;
const MAX_FILE_BYTES = 120 * 1024;

/** Collect the showcase's source files (root + up to 2 levels) into a snapshot. */
export function loadShowcaseFiddle(entry: ShowcaseEntry, workspaceRoot: string): FiddleSnapshot | null {
  const fs = foundationApi()?.fs;
  if (!fs) return null;

  const collected: Array<{ rel: string; content: string }> = [];

  const walk = (dir: string, relPrefix: string, depth: number) => {
    if (collected.length >= MAX_FILES || depth > 2) return;
    let entries: string[] = [];
    try { entries = fs.readdir?.(dir) ?? []; } catch (_) { return; }
    entries.sort();
    // files first so shallow files win the MAX_FILES budget over deep ones
    for (const name of entries) {
      if (collected.length >= MAX_FILES) return;
      if (SKIP_FILES.has(name) || name.startsWith('.')) continue;
      if (!CODE_FILE.test(name)) continue;
      const p = fs.join?.(dir, name) ?? dir + '/' + name;
      try {
        const content: string = fs.readFile?.(p) ?? '';
        if (content.length > MAX_FILE_BYTES) continue;
        collected.push({ rel: relPrefix + name, content });
      } catch (_) {}
    }
    for (const name of entries) {
      if (collected.length >= MAX_FILES) return;
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      const p = fs.join?.(dir, name) ?? dir + '/' + name;
      try {
        if (fs.readdir?.(p) != null) walk(p, relPrefix + name + '/', depth + 1);
      } catch (_) { /* not a directory */ }
    }
  };
  walk(workspaceRoot, '', 0);

  if (collected.length === 0) return null;

  const files = new Map<EditorId, FiddleFile>();
  let visibleBudget = 4;
  for (const f of collected) {
    const isMeta = f.rel === 'package.json' || f.rel.endsWith('.config.js') || f.rel.endsWith('.config.ts');
    const visible = !isMeta && f.content.length > 0 && visibleBudget > 0;
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
