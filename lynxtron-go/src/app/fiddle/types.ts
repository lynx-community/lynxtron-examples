export const DEFAULT_EDITORS = {
  MAIN: 'main.js',
  RENDERER: 'renderer.js',
  PRELOAD: 'preload.js',
  CSS: 'styles.css',
  PACKAGE: 'package.json',
} as const;

export type EditorId = string;

// Mosaic sort order — mirrors upstream Fiddle's KNOWN_FILES (compareEditors):
// known ids in this order first, unknown files lexicographic after.
export const KNOWN_FILES: string[] = [
  'main.cjs',
  'main.js',
  'main.mjs',
  'renderer.cjs',
  'renderer.js',
  'renderer.mjs',
  'preload.cjs',
  'preload.js',
  'preload.mjs',
  'styles.css',
];

export function compareEditors(a: EditorId, b: EditorId): number {
  const ia = KNOWN_FILES.indexOf(a);
  const ib = KNOWN_FILES.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
}

// Pane toolbar titles — upstream getEditorTitle().
const EDITOR_TITLES: Record<string, string> = {
  'main.js': 'Main Process (main.js)',
  'renderer.js': 'Renderer Process (renderer.js)',
  'preload.js': 'Preload (preload.js)',
  'styles.css': 'Stylesheet (styles.css)',
  'package.json': 'Package (package.json)',
};

export function getEditorTitle(id: EditorId): string {
  return EDITOR_TITLES[id] ?? id;
}
