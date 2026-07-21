// IDE-module: choosing which file the editor should auto-open when a workspace
// is loaded without an explicit file navigation (e.g. the Gallery "IDE" action's
// deep link, which carries only a showcase id and target=ide). Kept pure and
// dependency-injected so it is unit-testable and free of App.tsx coupling.

/** Nested source entry points, best first — showcases put app code under src/. */
export const PRIMARY_ENTRIES: string[] = [
  'src/app/index.tsx', 'src/app/index.ts',
  'src/index.tsx', 'src/index.ts',
  'src/app/App.tsx', 'src/App.tsx',
  'index.tsx', 'index.ts', 'App.tsx',
];

const SOURCE_EXT = /\.(tsx?|jsx?|css|md|html?)$/i;

/** Project meta/config files that should never be the auto-opened file if a
 *  real source file is available. Mirrors the Fiddle's isMetaFile classifier. */
export function isMetaFile(rel: string): boolean {
  return /(^|\/)package\.json$/.test(rel)
    || /(^|\/)tsconfig[^/]*\.json$/.test(rel)
    || /\.config\.(js|ts|mjs|cjs)$/.test(rel)
    || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(rel);
}

/**
 * Pick a workspace-relative file to auto-open, or null when the workspace has
 * no files at all. Preference order:
 *   1. A known nested source entry point that actually exists (probed via `exists`).
 *   2. The first top-level real source file (skipping config).
 *   3. The first top-level non-meta file (so a config-only + asset workspace still
 *      opens the asset rather than nothing).
 *   4. Any top-level file — better to show something than an empty editor.
 */
export function pickDefaultFile(opts: {
  topLevelFiles: string[];             // top-level file names (directories excluded)
  exists: (relPath: string) => boolean; // probe for nested known entry points
}): string | null {
  for (const cand of PRIMARY_ENTRIES) {
    if (opts.exists(cand)) return cand;
  }
  const sorted = opts.topLevelFiles.slice().sort();
  const source = sorted.find(f => SOURCE_EXT.test(f) && !isMetaFile(f));
  if (source) return source;
  const nonMeta = sorted.find(f => !isMetaFile(f));
  if (nonMeta) return nonMeta;
  return sorted[0] ?? null;
}
