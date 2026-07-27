// Assemble a loose fiddle source folder into a complete, standalone Lynxtron
// project, then (optionally) build and run it.
//
// This mirrors how Electron Fiddle runs upstream's docs/fiddles: those folders
// hold nothing but source (no package.json, no build config), and Fiddle
// synthesizes a throwaway project around them at run time and spawns Electron
// on it. We do the same, with one extra step Electron does not need — Lynx has
// no runtime source loading, so the renderer must be compiled to a
// `.lynx.bundle` before the window can load it.
//
//   node scripts/assemble.mjs <id|--all> [--build] [--run] [--out <dir>]
//
// Assembling is deliberately cheap and idempotent: everything under the output
// directory is generated, so it can be deleted at any time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FIDDLES_DIR = path.join(ROOT, 'fiddles');
const KIT_DIR = path.join(ROOT, 'kit');
const DEFAULT_OUT = path.join(ROOT, '.assembled');

/** Read the catalog without executing TypeScript — same parse the gallery uses. */
export function readCatalog() {
  const src = fs.readFileSync(path.join(ROOT, 'catalog.ts'), 'utf-8');
  const body = src.slice(src.indexOf('export const FIDDLES'));
  const out = [];
  for (const block of body.split(/\n  \{\n/).slice(1)) {
    const field = (name) => {
      const m = new RegExp(`\\n?\\s*${name}: '((?:[^'\\\\]|\\\\.)*)'`).exec(block);
      return m ? m[1].replace(/\\'/g, "'") : undefined;
    };
    const id = field('id');
    const status = field('status');
    if (!id || !status) continue;
    const win = /window: \{([^}]*)\}/.exec(block);
    out.push({
      id,
      dir: field('dir'),
      title: field('title') ?? id,
      status,
      upstream: field('upstream') ?? '',
      window: win ? win[1].trim() : '',
    });
  }
  return out;
}

/** Every fiddle that has source on disk (i.e. is not an `na` catalog row). */
export function listAssemblable() {
  return readCatalog().filter(
    (f) => f.status !== 'na' && f.upstream && fs.existsSync(path.join(FIDDLES_DIR, f.upstream, 'main.ts')),
  );
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function symlink(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  try {
    fs.unlinkSync(linkPath);
  } catch {
    /* not there yet */
  }
  fs.symlinkSync(target, linkPath, 'dir');
}

const LYNX_CONFIG = `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// Single entry — the chunk MUST be named \`main\`: the Lynx template toolchain
// asserts on its existence and fails the build with "Invariant failed" without it.
export default defineConfig({
  output: { filename: '[name].[platform].bundle' },
  environments: {
    lynx: {
      source: { entry: { main: './renderer.tsx' } },
      output: { distPath: { root: './output/bundle/lynx' } },
    },
  },
  plugins: [pluginReactLynx({ enableCSSInheritance: true })],
});
`;

function rspackConfig(hasPreload) {
  const entries = ["    main: './main.ts',"];
  if (hasPreload) entries.push("    preload: './preload.ts',");
  return `import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  target: 'electron-main',
  entry: {
${entries.join('\n')}
  },
  output: { path: path.resolve(__dirname, 'dist/desktop/'), filename: '[name].js' },
  module: {
    rules: [
      {
        test: /\\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } },
        type: 'javascript/auto',
      },
    ],
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './package.json', to: 'package.json' },
        { from: './output/bundle/lynx/', to: '.' },
      ],
    }),
  ],
  resolve: { extensions: ['.ts', '.js'] },
});
`;
}

/**
 * Materialize one fiddle as a self-contained project.
 * Returns the project root.
 */
export function assemble(fiddle, outRoot = DEFAULT_OUT) {
  const srcDir = path.join(FIDDLES_DIR, fiddle.upstream);
  if (!fs.existsSync(srcDir)) throw new Error(`no source for ${fiddle.id} at ${srcDir}`);

  const dest = path.join(outRoot, fiddle.id);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  // 1. the fiddle's own loose source, verbatim
  for (const name of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, name), path.join(dest, name));
  }
  const hasPreload = fs.existsSync(path.join(dest, 'preload.ts'));

  // 2. the shared kit travels with the project, so the assembled output stays
  //    runnable on its own rather than pointing back into this repo
  copyDir(KIT_DIR, path.join(dest, 'kit'));

  // 3. generated project scaffolding — the part upstream fiddles do not carry
  fs.writeFileSync(
    path.join(dest, 'package.json'),
    JSON.stringify(
      {
        name: `fiddle-${fiddle.id}`,
        version: '0.0.0',
        private: true,
        main: 'main.js',
        scripts: { build: 'rspeedy build && rspack build', start: 'lynxtron ./dist/desktop' },
        dependencies: { '@lynx-js/lynxtron': '*' },
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
  fs.writeFileSync(path.join(dest, 'lynx.config.ts'), LYNX_CONFIG, 'utf-8');
  fs.writeFileSync(path.join(dest, 'rspack.config.ts'), rspackConfig(hasPreload), 'utf-8');

  // 4. dependency resolution. The kit is shadowed in as a real package so the
  //    fiddle's `@lynxtron-examples/fiddle-kit` import resolves; everything else
  //    (rspeedy, @lynx-js/react, rspack) is found by Node walking up to the
  //    showcase's own node_modules.
  symlink(path.join(dest, 'kit'), path.join(dest, 'node_modules', '@lynxtron-examples', 'fiddle-kit'));

  return dest;
}

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => resolve({ code: -1, out: String(e) }));
    child.on('close', (code) => resolve({ code, out }));
  });
}

/** rspeedy compiles the renderer to a .lynx.bundle; rspack compiles main/preload. */
export async function build(projectRoot) {
  const bin = (name) => path.join(ROOT, 'node_modules', '.bin', name);
  for (const step of ['rspeedy', 'rspack']) {
    const r = await run(bin(step), ['build'], projectRoot);
    if (r.code !== 0) return { ok: false, step, output: r.out };
  }
  return { ok: true };
}

/** Build many projects with bounded concurrency — each build is its own process. */
async function buildAll(projects, concurrency) {
  const results = [];
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= projects.length) return;
      const { id, dest } = projects[i];
      const started = Date.now();
      const r = await build(dest);
      results.push({ id, ...r, seconds: (Date.now() - started) / 1000 });
      console.log(
        r.ok
          ? `  ok   ${id} (${((Date.now() - started) / 1000).toFixed(1)}s)  [${results.length}/${projects.length}]`
          : `  FAIL ${id} at ${r.step}  [${results.length}/${projects.length}]`,
      );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const outRoot = value('--out') ? path.resolve(value('--out')) : DEFAULT_OUT;
  const positional = argv.filter((a) => !a.startsWith('--') && a !== value('--out'));

  const all = listAssemblable();
  const targets = flag('--all') ? all : all.filter((f) => positional.includes(f.id));
  if (!targets.length) {
    console.error(
      positional.length
        ? `No assemblable fiddle matched: ${positional.join(', ')}`
        : 'usage: assemble.mjs <id...>|--all [--build] [--run] [--out <dir>]',
    );
    process.exit(1);
  }

  const projects = targets.map((f) => ({ id: f.id, dest: assemble(f, outRoot) }));
  console.log(`assembled ${projects.length} project(s) -> ${outRoot}`);

  let failed = [];
  if (flag('--build')) {
    const concurrency = Number(value('--jobs') ?? 6);
    const results = await buildAll(projects, concurrency);
    failed = results.filter((r) => !r.ok);
    console.log(`\nbuilt ${results.length - failed.length}/${results.length}`);
    for (const f of failed) {
      console.error(`\n--- ${f.id} (${f.step}) ---\n${f.output.split('\n').slice(-25).join('\n')}`);
    }
  }

  if (flag('--run') && projects.length === 1) {
    const dist = path.join(projects[0].dest, 'dist', 'desktop');
    spawnSync(path.join(ROOT, 'node_modules', '.bin', 'lynxtron'), [dist], { stdio: 'inherit' });
  }

  process.exit(failed.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
