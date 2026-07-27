import { defineConfig } from '@lynx-js/rspeedy';

import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { compilerOptionsKeys, configKeys, type CompilerOptions, type Config } from '@lynx-js/type-config';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { pluginRspeedyDevReady } from '@lynx-js/lynxtron-dev-plugins/rspeedy';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync, execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = process.cwd();
const monorepoRoot = path.resolve(__dirname, '..');

// ── Bake-in showcase registry ─────────────────────────────────────────────
// Source mode:
// - remote: bake GitHub tree URLs for published/private-remote testing
// - local-registry: bake file:// tgz URLs for local registry / preview testing
// - local-workspace: keep local source-tree open fallback for runtime debugging
const showcaseSourceMode = (() => {
  const explicitMode = process.env.LYNXTRON_SHOWCASE_SOURCE;
  if (explicitMode === 'local-registry' || explicitMode === 'local-workspace') {
    return explicitMode;
  }
  if (process.env.LYNXTRON_PREVIEW) return 'local-registry';
  // Remote mode bakes {remote}/tree/{CURRENT BRANCH}/... into every showcase
  // URL. On a branch that was never pushed, every Run then 404s against the
  // GitHub tarball API — a local-only branch is by definition a local dev
  // build, so fall back to the local source tree. On any git/network error
  // keep remote (CI builds from pushed refs must not silently change mode).
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD',
      { cwd: monorepoRoot, encoding: 'utf-8' }).trim();
    // execFileSync, not a shell string: JSON.stringify is not shell escaping
    // (backticks/$ would pass straight through a branch name).
    const onOrigin = execFileSync('git', ['ls-remote', '--heads', 'origin', branch],
      { cwd: monorepoRoot, encoding: 'utf-8', timeout: 8000 }).trim();
    if (!onOrigin) {
      console.warn(`Branch "${branch}" is not on origin — baking local-workspace showcase sources instead of remote URLs.`);
      return 'local-workspace';
    }
  } catch (_) { /* offline / not a git checkout — keep remote */ }
  return 'remote';
})();
const isLocalSourceMode = showcaseSourceMode !== 'remote';
const isLocalRegistry = showcaseSourceMode === 'local-registry';
const isLocalWorkspace = showcaseSourceMode === 'local-workspace';
const registryPath = path.resolve(monorepoRoot, 'showcase-registry.json');

function resolveThumbnailUrl(thumbnail: string | null, gitRemote: string, gitBranch: string): string | null {
  if (!thumbnail) return null;
  if (isLocalSourceMode) {
    return pathToFileURL(path.resolve(monorepoRoot, thumbnail)).href;
  }
  if (!gitRemote) return null;
  const normalized = thumbnail.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
  return `${gitRemote}/raw/${gitBranch}/${normalized}`;
}

function buildShowcaseRegistry() {
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const gitRemote = (() => {
      try {
        const url = execSync('git remote get-url origin', { cwd: monorepoRoot, encoding: 'utf-8' }).trim();
        // Convert git@github.com:user/repo.git → https://github.com/user/repo
        return url.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
      } catch { return ''; }
    })();
    const gitBranch = (() => {
      try {
        return execSync('git rev-parse --abbrev-ref HEAD', { cwd: monorepoRoot, encoding: 'utf-8' }).trim();
      } catch { return 'main'; }
    })();

    return registry.showcases.map((s: any) => {
      let url = '';
      if (isLocalRegistry) {
        // Preview: point to local pre-packed tarball
        // Convention: showcases/<name>/<name>-<version>.tgz
        const showcaseDir = path.resolve(monorepoRoot, s.path);
        try {
          const files = fs.readdirSync(showcaseDir);
          const tgz = files.find((f: string) => f.endsWith('.tgz'));
          if (tgz) url = `file://${path.join(showcaseDir, tgz)}`;
        } catch (_) {}
      } else if (gitRemote) {
        url = `${gitRemote}/tree/${gitBranch}/${s.path}`;
      }
      return {
        name: s.name,
        description: s.description || '',
        tags: s.tags || [],
        targets: Array.isArray(s.targets) ? s.targets : ['desktop'],
        path: s.path || undefined,
        url,
        thumbnail: resolveThumbnailUrl(s.thumbnail ?? null, gitRemote, gitBranch),
      };
    });
  } catch (e) {
    console.warn('Failed to build showcase registry:', e);
    return [];
  }
}

const bakedShowcases = buildShowcaseRegistry();
console.log(`Baking ${bakedShowcases.length} showcase(s), sourceMode=${showcaseSourceMode}`);

// ── Bake-in the Electron-fiddles catalog ──────────────────────────────────
// The electron-fiddles showcase is a gallery of its own: one Lynx bundle per
// ported Electron fiddle. The gallery lists them in a dedicated section, so it
// needs the per-fiddle metadata, not just the one showcase entry. Read straight
// from the showcase's manifest so there is a single source of truth; if the
// showcase is absent (a trimmed checkout), the section just does not render.
function buildFiddleCatalog(): { categories: string[]; fiddles: unknown[] } {
  const empty = { categories: [], fiddles: [] };
  try {
    const manifestPath = path.resolve(monorepoRoot, 'showcases/electron-fiddles/src/shared/manifest.ts');
    if (!fs.existsSync(manifestPath)) return empty;
    const src = fs.readFileSync(manifestPath, 'utf-8');

    const orderMatch = /export const CATEGORY_ORDER = \[([\s\S]*?)\] as const;/.exec(src);
    const categories = orderMatch
      ? [...orderMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : [];

    // The manifest is a flat array of object literals with string/boolean
    // fields — parse the fields we render rather than executing TypeScript.
    const fiddles: unknown[] = [];
    const body = src.slice(src.indexOf('export const FIDDLES'));
    for (const block of body.split(/\n  \{\n/).slice(1)) {
      const field = (name: string) => {
        const m = new RegExp(`\\n?\\s*${name}: '((?:[^'\\\\]|\\\\.)*)'`).exec(block);
        return m ? m[1].replace(/\\'/g, "'") : undefined;
      };
      const id = field('id');
      const title = field('title');
      const category = field('category');
      const status = field('status');
      if (!id || !title || !category || !status) continue;
      fiddles.push({
        id,
        title,
        category,
        status,
        description: field('description') ?? '',
        notes: field('notes') ?? '',
        upstream: field('upstream') ?? '',
      });
    }
    return { categories, fiddles };
  } catch (e) {
    console.warn('Failed to build electron-fiddles catalog:', e);
    return empty;
  }
}

const bakedFiddles = buildFiddleCatalog();
console.log(`Baking ${bakedFiddles.fiddles.length} Electron fiddle(s)`);
export default defineConfig({
  server: {
    port: 5817,
  },
  resolve: {
    alias: {
      '@assets': path.resolve(rootPath, './src/assets'),
    },
  },
  environments: {
    lynx: {
      source: {
        entry: {
          main: './src/app/index.tsx',
        },
      },
      output: {
        assetPrefix: `file://${path.resolve(__dirname, './dist/desktop/')}/`,
        distPath: {
          root: './output/bundle/lynx',
        },
      },
    },
  },
  output: {
    filename: '[name].[platform].bundle',
  },
  source: {
    define: {
      __SHOWCASE_REGISTRY__: JSON.stringify(bakedShowcases),
      __FIDDLE_CATALOG__: JSON.stringify(bakedFiddles),
      __SHOWCASE_PREVIEW__: JSON.stringify(isLocalSourceMode),
      __SHOWCASE_LOCAL_WORKSPACE__: JSON.stringify(isLocalWorkspace),
    },
  },
  plugins: [
    pluginLynxConfig({
      alignMouseEventWithW3C: true,
      enableCSSInheritance: true,
    }, {
      configKeys: [...configKeys, 'alignMouseEventWithW3C'],
      compilerOptionsKeys,
      validate: (input) => input as Config & CompilerOptions & {
        alignMouseEventWithW3C: boolean;
      },
    }),
    pluginReactLynx({
      enableCSSInheritance: true,
    } as any),
    pluginTypeCheck(),
    pluginRspeedyDevReady(),
  ],
});
