import { detectLanguage, type Language } from '../../syntax';
import { DEFAULT_EDITORS } from '../types';

export type EditorId = string;

export interface FiddleFile {
  id: EditorId;
  savedContent: string;
  currentText: string;
  language: Language;
  isDirty: boolean;
  /** Whether this file has a live mosaic pane (upstream: EditorPresence !== Hidden). */
  visible: boolean;
}

export interface FiddleSource {
  kind: 'blank' | 'template' | 'showcase' | 'gist' | 'local';
  ref?: string;
}

export interface FiddleSnapshot {
  source: FiddleSource;
  files: Map<EditorId, FiddleFile>;
  activeEditorId: EditorId | null;
  title: string;
}

const LANG_BY_ID: Record<string, Language> = {
  [DEFAULT_EDITORS.MAIN]: 'JavaScript',
  [DEFAULT_EDITORS.RENDERER]: 'JavaScript',
  [DEFAULT_EDITORS.PRELOAD]: 'JavaScript',
  [DEFAULT_EDITORS.CSS]: 'CSS',
  [DEFAULT_EDITORS.PACKAGE]: 'JSON',
};

export function languageForId(id: EditorId): Language {
  // Fall back to extension detection, NOT 'Plain Text': session restore runs
  // every file through here, and showcase files (src/app/App.tsx, …) aren't
  // in the fixed-id map — a Plain-Text fallback silently killed the highlight
  // for the whole restored session.
  return LANG_BY_ID[id] ?? detectLanguage(id);
}

export const HELLO_LYNXTRON: Record<EditorId, string> = {
  [DEFAULT_EDITORS.MAIN]: `// Main process — Lynxtron entry
const { app, LynxWindow } = require('lynxtron');

app.whenReady().then(() => {
  const win = new LynxWindow({ width: 800, height: 600 });
  // A LynxWindow renders a compiled Lynx bundle — renderer.js is built
  // into main.lynx.bundle by rspeedy. There is no HTML page in Lynxtron.
  win.loadFile('main.lynx.bundle');
});
`,
  [DEFAULT_EDITORS.RENDERER]: `// Renderer (Lynx UI) — ReactLynx entry
import { root } from '@lynx-js/react';
import './styles.css';

function App() {
  return (
    <view className="hello">
      <text className="hello-title">Hello, Lynxtron!</text>
    </view>
  );
}

root.render(<App />);
`,
  [DEFAULT_EDITORS.PRELOAD]: `// Preload script
// Runs in the Lynx bundle context before your app code.
`,
  [DEFAULT_EDITORS.CSS]: `.hello {
  padding: 24px;
}

.hello-title {
  font-size: 24px;
}
`,
  [DEFAULT_EDITORS.PACKAGE]: `{
  "name": "my-lynxtron-fiddle",
  "productName": "My Lynxtron Fiddle",
  "version": "1.0.0",
  "main": "main.js",
  "dependencies": {}
}
`,
};

export const BLANK_TEMPLATE: Record<EditorId, string> = {
  [DEFAULT_EDITORS.MAIN]: `const { app, LynxWindow } = require('lynxtron');\n\napp.whenReady().then(() => {\n  new LynxWindow({ width: 800, height: 600 });\n});\n`,
  [DEFAULT_EDITORS.RENDERER]: `import { root } from '@lynx-js/react';\nroot.render(<view />);\n`,
  [DEFAULT_EDITORS.PRELOAD]: ``,
  [DEFAULT_EDITORS.CSS]: ``,
  [DEFAULT_EDITORS.PACKAGE]: `{\n  "name": "blank-fiddle",\n  "version": "1.0.0",\n  "main": "main.js"\n}\n`,
};

// Upstream default mosaic shows main/renderer/html/preload; styles.css and
// package.json start hidden (their default content is "boring" — see
// upstream addFile()'s getEmptyContent check).
const HIDDEN_BY_DEFAULT = new Set<string>([DEFAULT_EDITORS.CSS, DEFAULT_EDITORS.PACKAGE]);

function fromRecord(record: Record<EditorId, string>, source: FiddleSource, title: string): FiddleSnapshot {
  const files = new Map<EditorId, FiddleFile>();
  for (const id of Object.values(DEFAULT_EDITORS)) {
    const content = record[id] ?? '';
    files.set(id, {
      id,
      savedContent: content,
      currentText: content,
      language: languageForId(id),
      isDirty: false,
      visible: !HIDDEN_BY_DEFAULT.has(id) && content.length > 0,
    });
  }
  return { source, files, activeEditorId: DEFAULT_EDITORS.MAIN, title };
}

/** Visible editor ids in mosaic order (upstream compareEditors sort happens in Editors). */
export function visibleEditorIds(snap: FiddleSnapshot): EditorId[] {
  const out: EditorId[] = [];
  for (const [id, f] of snap.files.entries()) if (f.visible) out.push(id);
  return out;
}

/**
 * A file id must stay strictly inside its workspace when joined onto a root:
 * relative, forward-slash only, no empty/./.. segments. Guards every
 * write-back path against traversal (e.g. "../outside.js").
 */
export function isSafeRelativePath(id: EditorId): boolean {
  if (!id || id.startsWith('/') || id.includes('\\')) return false;
  return id.split('/').every(seg => seg.length > 0 && seg !== '.' && seg !== '..');
}

/** Project meta/config files never occupy a default mosaic pane. */
export function isMetaFile(id: EditorId): boolean {
  return /(^|\/)package\.json$/.test(id)
    || /(^|\/)tsconfig[^/]*\.json$/.test(id)
    || /\.config\.(js|ts|mjs|cjs)$/.test(id)
    || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(id);
}

/**
 * The load-time default visible set: the first few non-meta files with real
 * content (map insertion order = KNOWN_FILES order for templates, shallow
 * walk order for showcases). Upstream resetLayout restores the layout the
 * fiddle was loaded with — not "every file side by side".
 */
export function defaultVisibleIds(files: Map<EditorId, FiddleFile>, budget = 4): Set<EditorId> {
  const out = new Set<EditorId>();
  for (const [id, f] of files.entries()) {
    if (out.size >= budget) break;
    if (!f.currentText.length || isMetaFile(id) || HIDDEN_BY_DEFAULT.has(id)) continue;
    out.add(id);
  }
  if (out.size === 0) {
    for (const [id, f] of files.entries()) {
      if (f.currentText.length) { out.add(id); break; }
    }
  }
  return out;
}

// ── Session persistence (fiddle.lastSession in foundation.config) ─────────

export interface PersistedSession {
  title: string;
  source: FiddleSource;
  activeEditorId: EditorId | null;
  files: Array<{ id: EditorId; savedContent: string; currentText: string; visible: boolean }>;
}

export function toPersisted(snap: FiddleSnapshot): PersistedSession {
  return {
    title: snap.title,
    source: snap.source,
    activeEditorId: snap.activeEditorId,
    files: [...snap.files.values()].map(f => ({
      id: f.id,
      savedContent: f.savedContent,
      currentText: f.currentText,
      visible: f.visible,
    })),
  };
}

export function fromPersisted(p: PersistedSession): FiddleSnapshot | null {
  if (!p || !Array.isArray(p.files) || p.files.length === 0) return null;
  const files = new Map<EditorId, FiddleFile>();
  for (const f of p.files) {
    if (!f || typeof f.id !== 'string') return null;
    files.set(f.id, {
      id: f.id,
      savedContent: typeof f.savedContent === 'string' ? f.savedContent : '',
      currentText: typeof f.currentText === 'string' ? f.currentText : '',
      language: languageForId(f.id),
      isDirty: f.currentText !== f.savedContent,
      visible: !!f.visible,
    });
  }
  return {
    source: p.source ?? { kind: 'local' },
    files,
    activeEditorId: p.activeEditorId ?? files.keys().next().value ?? null,
    title: p.title || 'Untitled Fiddle',
  };
}

export function helloLynxtronFiddle(): FiddleSnapshot {
  return fromRecord(HELLO_LYNXTRON, { kind: 'template', ref: 'hello-lynxtron' }, 'Hello Lynxtron');
}

export function blankFiddle(): FiddleSnapshot {
  return fromRecord(BLANK_TEMPLATE, { kind: 'blank' }, 'Untitled Fiddle');
}

/** @deprecated use helloLynxtronFiddle() */
export function emptyFiddle(): FiddleSnapshot {
  return helloLynxtronFiddle();
}

export function isFiddleEdited(snap: FiddleSnapshot): boolean {
  for (const f of snap.files.values()) if (f.isDirty) return true;
  return false;
}

export function serializeFiddle(snap: FiddleSnapshot): Record<EditorId, string> {
  const out: Record<EditorId, string> = {};
  for (const [id, f] of snap.files.entries()) out[id] = f.currentText;
  return out;
}
