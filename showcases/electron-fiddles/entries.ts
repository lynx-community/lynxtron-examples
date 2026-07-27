// Derives the rspeedy multi-entry map from the fiddle manifest.
// Only fiddles whose entry file actually exists on disk are included, so the
// project builds green as fiddles are added incrementally.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIDDLES } from './src/shared/manifest.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export const FIDDLE_ENTRIES: Record<string, string> = {
  // NOTE: the home gallery must be the entry literally named `main` — the Lynx
  // template toolchain requires a `main` chunk to exist (builds without one
  // fail with "Invariant failed" in ReactWebpackPlugin#updateMainThreadInfo).
  main: './src/home/index.tsx',
};

for (const f of FIDDLES) {
  if (f.status === 'na' || !f.dir) continue;
  const rel = `./src/fiddles/${f.dir}/index.tsx`;
  if (fs.existsSync(path.resolve(here, rel))) {
    FIDDLE_ENTRIES[f.id] = rel;
  }
}
