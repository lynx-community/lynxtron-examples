'use strict';

const fs = require('fs');
const path = require('path');

// Match the staged closure, not versions left over in the manifest template.
// Otherwise the builder rejects appDir and falls back to development deps.
function synchronizeRuntimeManifest(appDir) {
  const manifestPath = path.join(appDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const stagedPath = path.join(appDir, 'node_modules', name, 'package.json');
    const staged = JSON.parse(fs.readFileSync(stagedPath, 'utf8'));
    if (!staged.name || !staged.version) throw new Error(`Invalid staged dependency: ${name}`);
    manifest.dependencies[name] = staged.name === name
      ? staged.version
      : `npm:${staged.name}@${staged.version}`;
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

module.exports = { synchronizeRuntimeManifest };
