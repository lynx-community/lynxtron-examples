import { getExposed, foundationApi } from '../../store';
import { detectLanguage } from '../../syntax';
import { DEFAULT_EDITORS } from '../types';
import { languageForId, type FiddleSnapshot, type FiddleFile, type EditorId, defaultVisibleIds } from '../state/FiddleState';

/**
 * Load a saved fiddle folder back into a snapshot (File → Open...).
 * Reads the fixed editor set plus any extra .js/.html/.css/.json files
 * that live directly in the folder.
 */
export function loadLocalFiddle(dir: string): FiddleSnapshot | null {
  const fs = foundationApi()?.fs;
  if (!fs) return null;

  const files = new Map<EditorId, FiddleFile>();
  const readIfExists = (name: string): string | null => {
    const p: string = fs.join?.(dir, name) ?? dir + '/' + name;
    try {
      if (fs.exists?.(p)) return fs.readFile?.(p) ?? '';
    } catch (_) {}
    return null;
  };

  let anyFound = false;
  for (const id of Object.values(DEFAULT_EDITORS)) {
    const content = readIfExists(id);
    if (content !== null) anyFound = true;
    files.set(id, {
      id,
      savedContent: content ?? '',
      currentText: content ?? '',
      language: languageForId(id),
      isDirty: false,
      visible: (content ?? '').length > 0,
    });
  }
  if (!anyFound) return null;

  // Pick up extra editor files saved alongside the fixed set.
  try {
    const entries: string[] = fs.readdir?.(dir) ?? [];
    for (const name of entries) {
      if (files.has(name)) continue;
      if (!/\.(cjs|js|mjs|html|css|json)$/.test(name)) continue;
      const content = readIfExists(name);
      if (content === null) continue;
      files.set(name, {
        id: name,
        savedContent: content,
        currentText: content,
        language: detectLanguage(name),
        isDirty: false,
        visible: content.length > 0,
      });
    }
  } catch (_) { /* readdir unsupported — fixed set only */ }

  // Cap the initial mosaic to the important files — a folder full of matches
  // would otherwise open one pane per file (unusable past ~6 panes).
  const show = defaultVisibleIds(files);
  for (const [id, f] of files.entries()) {
    if (f.visible !== show.has(id)) files.set(id, { ...f, visible: show.has(id) });
  }

  return {
    source: { kind: 'local', ref: dir },
    files,
    activeEditorId: DEFAULT_EDITORS.MAIN,
    title: dir.split('/').pop() || 'Local Fiddle',
  };
}
