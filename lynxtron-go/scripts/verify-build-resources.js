#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const tar = require('tar');

const projectRoot = path.resolve(__dirname, '..');
const desktopDir = path.join(projectRoot, 'dist', 'desktop');
const appManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const requiredFiles = [
  'main.lynx.bundle',
  'help.html',
  'brand/lynxtron.png',
  'brand/lynxtron-on-dark.png',
];
const missing = requiredFiles.filter(relativePath =>
  !fs.existsSync(path.join(desktopDir, relativePath))
);
if (missing.length > 0) throw new Error(`Missing built resources: ${missing.join(', ')}`);

async function verifyBuiltinShowcase() {
  const builtinDir = path.join(desktopDir, 'builtin-showcases');
  const artifacts = fs.existsSync(builtinDir)
    ? fs.readdirSync(builtinDir).filter(file => /^lynxtron-examples-hello-lynxtron-.+\.tgz$/.test(file))
    : [];
  if (artifacts.length !== 1) {
    throw new Error(`Expected exactly one built-in Hello artifact, found: ${artifacts.join(', ') || 'none'}`);
  }

  const artifactPath = path.join(builtinDir, artifacts[0]);
  const entries = [];
  await tar.t({
    file: artifactPath,
    onentry: entry => entries.push(entry.path),
  });
  const requiredEntries = [
    'package/.lynxtron-release.json',
    'package/dist_precompiled/desktop/main.js',
    'package/dist_precompiled/desktop/main.lynx.bundle',
    'package/dist_precompiled/desktop/package.json',
  ];
  const missingEntries = requiredEntries.filter(entry => !entries.includes(entry));
  if (missingEntries.length > 0) {
    throw new Error(`Built-in Hello artifact is incomplete: ${missingEntries.join(', ')}`);
  }

  // The extracted artifact is installed with npm outside the pnpm workspace.
  // Its build configuration must therefore use only APIs present in published
  // package versions. Keep the tiny Lynxtron external mapping self-contained;
  // importing a workspace-only config subpath produces a tarball that packs
  // successfully but fails as soon as source fallback runs `npm run build`.
  const extractedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-builtin-verify-'));
  try {
    await tar.x({
      file: artifactPath,
      cwd: extractedRoot,
      filter: entry => entry === 'package/package.json' || entry === 'package/rspack.config.ts',
    });
    const packageRoot = path.join(extractedRoot, 'package');
    const showcaseManifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const configVersion = showcaseManifest.devDependencies?.['@lynxtron-examples/config'];
    if (typeof configVersion !== 'string' || /^(?:workspace|catalog|file|link):/.test(configVersion)) {
      throw new Error(`Built-in Hello does not reference a published config version: ${configVersion}`);
    }
    const rspackConfig = fs.readFileSync(path.join(packageRoot, 'rspack.config.ts'), 'utf8');
    if (rspackConfig.includes('@lynxtron-examples/config/rspack')) {
      throw new Error('Built-in Hello imports the workspace-only config/rspack subpath.');
    }
    if (!rspackConfig.includes("'@lynx-js/lynxtron': 'commonjs lynxtron'")) {
      throw new Error('Built-in Hello does not inline the portable Lynxtron runtime external.');
    }
  } finally {
    fs.rmSync(extractedRoot, { recursive: true, force: true });
  }
  return artifacts[0];
}
const thumbnailDir = path.join(desktopDir, 'thumbnails');
const thumbnails = fs.existsSync(thumbnailDir)
  ? fs.readdirSync(thumbnailDir).filter(file => file.endsWith('.png'))
  : [];
if (thumbnails.length === 0) {
  throw new Error('No packaged gallery thumbnails were generated.');
}

const bundle = fs.readFileSync(path.join(desktopDir, 'main.lynx.bundle')).toString('latin1');
const forbiddenBuildPaths = [
  projectRoot,
  '/Users/runner/',
  '/home/runner/',
  'D:\\a\\',
];
const leakedPath = forbiddenBuildPaths.find(value => bundle.includes(value));
if (leakedPath) {
  throw new Error(`Lynx bundle contains a build-machine path: ${leakedPath}`);
}
if (bundle.includes('blueprint-icons-16')) {
  throw new Error('Lynx bundle still references the obsolete icon-font alias.');
}
if (!bundle.includes('pt-iconosaurus-16')) {
  throw new Error('Lynx bundle is missing the icon font native family name.');
}

const runtimeManifest = JSON.parse(fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
if (runtimeManifest.version !== appManifest.version) {
  throw new Error(
    `Packaged runtime manifest version ${runtimeManifest.version} does not match app version ${appManifest.version}.`,
  );
}
const cssLanguageServiceRuntime = [
  'vscode-css-languageservice',
  '@vscode/l10n',
  'vscode-languageserver-textdocument',
  'vscode-languageserver-types',
  'vscode-uri',
];
for (const packageName of cssLanguageServiceRuntime) {
  if (!runtimeManifest.dependencies?.[packageName]) {
    throw new Error(`CSS language service runtime dependency is not declared: ${packageName}`);
  }
  if (!fs.existsSync(path.join(desktopDir, 'node_modules', packageName, 'package.json'))) {
    throw new Error(`CSS language service runtime dependency is not staged: ${packageName}`);
  }
}

const releaseTag = process.env.LYNXTRON_RELEASE_TAG;
if (releaseTag) {
  const expectedArtifactPrefix = `/releases/download/${encodeURIComponent(releaseTag)}/lynxtron-examples-`;
  if (!bundle.includes(expectedArtifactPrefix)) {
    throw new Error(
      `Release build did not bake showcase artifact URLs for ${releaseTag}; expected ${expectedArtifactPrefix}.`,
    );
  }
}

void verifyBuiltinShowcase().then((builtinArtifact) => {
  console.log(
    `[pack] verified resources: ${requiredFiles.length} required files, `
    + `${thumbnails.length} thumbnails, built-in ${builtinArtifact}, `
    + `${cssLanguageServiceRuntime.length} CSS service packages, `
    + `runtime version ${runtimeManifest.version}, no build-machine paths`,
  );
}).catch((error) => {
  console.error(`[pack] resource verification failed: ${error.message}`);
  process.exitCode = 1;
});
