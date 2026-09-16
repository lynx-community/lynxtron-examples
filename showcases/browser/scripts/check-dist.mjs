import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const showcaseRoot = fileURLToPath(new URL('../', import.meta.url));
const desktop = path.resolve(process.argv[2] || path.join(showcaseRoot, 'dist/desktop'));
const cefRoot = path.join(desktop, '.lynxtron/native/node_modules/@lynx-js/cef-webview');
const requireFile = file => {
  if (!fs.existsSync(file)) throw new Error(`Missing Browser runtime asset: ${file}`);
};
for (const file of ['main.js', 'preload.js', 'main.lynx.bundle', 'package.json']) requireFile(path.join(desktop, file));
requireFile(path.join(cefRoot, 'lynx.lib.json'));
const manifest = JSON.parse(fs.readFileSync(path.join(cefRoot, 'lynx.lib.json'), 'utf8'));
const target = manifest.platforms.lynxtron.targets.find(({ os, arch }) => os === process.platform && arch === process.arch);
if (!target) throw new Error(`CEF does not support ${process.platform}/${process.arch}`);
for (const file of [...target.files, ...(target.frameworks || []), ...(target.appBundles || [])]) requireFile(path.join(cefRoot, file));
for (const file of ['main.js', 'preload.js']) {
  if (fs.readFileSync(path.join(desktop, file), 'utf8').includes(showcaseRoot.replace(/\/$/, ''))) {
    throw new Error(`${file} contains the source checkout path`);
  }
}
console.log(`Browser dist verified: ${process.platform}/${process.arch}, CEF assets staged.`);
