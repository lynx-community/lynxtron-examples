'use strict';

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  '@lynx-js/react/package.json',
  '@lynx-js/react/types/react.d.ts',
  '@lynx-js/react/runtime/lib/lynx-api.d.ts',
  '@lynx-js/react/runtime/lib/core/hooks/react.d.ts',
  '@lynx-js/react/runtime/jsx-runtime/index.d.ts',
  '@lynx-js/types/types/index.d.ts',
  'preact/src/index.d.ts',
  'preact/compat/src/index.d.ts',
  '@types/react/index.d.ts',
  '@types/prop-types/index.d.ts',
  'csstype/index.d.ts',
  '@types/node/index.d.ts',
  'undici-types/index.d.ts',
  'typescript/lib/typescript.js',
];

module.exports = async function verifyPackagedTypes(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const archive = path.join(resources, 'app.asar');
  let exists;
  if (fs.existsSync(archive)) {
    const builderRoot = path.dirname(require.resolve('app-builder-lib/package.json'));
    const asar = require(require.resolve('@electron/asar', { paths: [builderRoot] }));
    exists = relative => {
      try { return !asar.statFile(archive, relative).files; } catch { return false; }
    };
  } else {
    exists = relative => fs.existsSync(path.join(resources, 'app', relative));
  }
  const missing = requiredFiles.map(file => `node_modules/${file}`).filter(file => !exists(file));
  if (missing.length) throw new Error(`Final application is missing bundled language-service files: ${missing.join(', ')}`);
  console.log(`[pack] verified ${requiredFiles.length} language-service files in final application`);
};
