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
