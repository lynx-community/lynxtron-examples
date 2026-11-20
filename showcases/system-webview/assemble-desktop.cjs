const fs = require('node:fs');
const path = require('node:path');

// Assemble the showcase layout that Lynxtron Go runs: `lynxtron ./dist/desktop`
// needs the desktop entry, the compiled Lynx bundle, and the native extension
// side by side, with a package.json whose `main` points at the entry.
const root = __dirname;
const outDir = path.join(root, 'dist', 'desktop');
const bundlePath = path.join(root, 'output', 'bundle', 'lynx', 'main.lynx.bundle');
const nativePath = path.join(root, 'build', 'system_webview.node');

for (const [label, file] of [
  ['Lynx bundle', bundlePath],
  ['native extension', nativePath],
]) {
  if (!fs.existsSync(file)) {
    throw new Error(`${label} not found at ${file}. Run the full build first.`);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'build'), { recursive: true });

fs.copyFileSync(path.join(root, 'main.cjs'), path.join(outDir, 'main.cjs'));
fs.copyFileSync(bundlePath, path.join(outDir, 'main.lynx.bundle'));
fs.copyFileSync(nativePath, path.join(outDir, 'build', 'system_webview.node'));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(
  path.join(outDir, 'package.json'),
  `${JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: 'main.cjs',
    },
    null,
    2,
  )}\n`,
);

console.log(`Assembled ${path.relative(root, outDir)}`);
