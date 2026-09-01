import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as path from 'path';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rspack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const isDev = process.env.NODE_ENV === 'development';

// Copy sqlite3 and its full transitive dependency tree into dist/desktop/node_modules
// so the externalized native module + its runtime deps (bindings, node-addon-api,
// etc.) can be resolved when Lynxtron loads preload.js.
class CopyNativeModulesPlugin {
  apply(compiler: any) {
    compiler.hooks.afterEmit.tapAsync('CopyNativeModulesPlugin', (_compilation: any, cb: any) => {
      try {
        const distNodeModules = path.join(__dirname, 'dist', 'desktop', 'node_modules');

        const sqlite3Entry = require.resolve('sqlite3', { paths: [__dirname] });
        let sqlite3Dir = path.dirname(sqlite3Entry);
        while (sqlite3Dir !== path.dirname(sqlite3Dir)) {
          if (fs.existsSync(path.join(sqlite3Dir, 'package.json'))) break;
          sqlite3Dir = path.dirname(sqlite3Dir);
        }

        const visited = new Set<string>();
        const queue: { dir: string; name: string }[] = [];

        const enqueue = (pkgDir: string, pkgName: string) => {
          const realPath = fs.realpathSync(pkgDir);
          if (visited.has(realPath)) return;
          visited.add(realPath);
          queue.push({ dir: realPath, name: pkgName });
        };

        enqueue(sqlite3Dir, 'sqlite3');

        while (queue.length > 0) {
          const { dir: pkgDir, name: pkgName } = queue.shift()!;
          copyModuleToDist(pkgDir, distNodeModules, pkgName);

          const pkgJsonPath = path.join(pkgDir, 'package.json');
          if (!fs.existsSync(pkgJsonPath)) continue;
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          const deps = Object.keys(pkgJson.dependencies || {});
          if (deps.length === 0) continue;

          const parentNodeModules = path.dirname(pkgDir);
          if (path.basename(parentNodeModules) !== 'node_modules') continue;

          for (const dep of deps) {
            const depPath = path.join(parentNodeModules, dep);
            if (!fs.existsSync(depPath)) continue;
            if (dep.startsWith('@')) {
              for (const sub of fs.readdirSync(depPath)) {
                if (sub.startsWith('.')) continue;
                enqueue(path.join(depPath, sub), `${dep}/${sub}`);
              }
            } else {
              enqueue(depPath, dep);
            }
          }
        }
        cb();
      } catch (err) {
        cb(err);
      }
    });
  }
}

function copyModuleToDist(srcDir: string, destNodeModules: string, pkgName: string) {
  const dest = path.join(destNodeModules, pkgName);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  copyDir(srcDir, dest);
}

function copyDir(src: string, dest: string) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    copyDir(fs.realpathSync(src), dest);
    return;
  }
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyDir(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

export default defineConfig({
  target: 'electron-main',
  entry: {
    main: './src/main/desktop/main.ts',
    preload: './src/main/desktop/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/desktop/'),
    filename: '[name].js',
  },
  externals: {
    sqlite3: 'commonjs sqlite3',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } },
        type: 'javascript/auto',
      },
    ],
  },
  plugins: [
    // Prevent bundlers from baking the build machine's absolute `import.meta.url`
    // (e.g. `file:///Users/runner/...`) into the CommonJS output. The `@lynx-js/lynxtron`
    // ESM shim calls `createRequire(import.meta.url)`, which crashes on other machines
    // (especially cross-OS). `__filename` is a valid absolute path at runtime and is
    // resolved against the shipped `main.js` instead.
    new rspack.DefinePlugin({
      'import.meta.url': '__filename',
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './package.json', to: 'package.json' },
        { from: './output/bundle/lynx/', to: '.' },
      ],
    }),
    new CopyNativeModulesPlugin(),
    ...(isDev ? [pluginLynxtron({ isDev, entry: path.resolve(__dirname, './dist/desktop') })] : []),
  ],
  resolve: { extensions: ['.ts', '.js'] },
});
