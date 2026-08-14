#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const desktopDir = path.join(projectRoot, 'dist', 'desktop');
const requiredFiles = [
  'main.lynx.bundle',
  'help.html',
  'brand/lynxtron.png',
  'brand/lynxtron-on-dark.png',
];

const missing = requiredFiles.filter(relativePath =>
  !fs.existsSync(path.join(desktopDir, relativePath))
);
if (missing.length > 0) {
  throw new Error(`Missing built resources: ${missing.join(', ')}`);
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

console.log(
  `[pack] verified resources: ${requiredFiles.length} required files, `
  + `${thumbnails.length} thumbnails, no build-machine paths`,
);
