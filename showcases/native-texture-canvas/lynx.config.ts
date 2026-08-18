import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const showcaseDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(showcaseDir, 'native-texture-extension');
const files = [
  'index.cjs',
  'build/Release/native_texture_canvas_module.node',
];

function sha256(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const manifest = {
  schemaVersion: 1,
  name: 'lynxtron-native-texture-canvas',
  platform: process.platform,
  arch: process.arch,
  entry: 'index.cjs',
  files: files.map((relativePath) => ({
    path: relativePath,
    url: `node_modules/lynxtron-native-texture-canvas/${relativePath}`,
    sha256: sha256(path.join(extensionDir, relativePath)),
  })),
};

const encodedManifest = Buffer.from(JSON.stringify(manifest), 'utf8').toString('base64');
const marker = `LYNXTRON_NATIVE_EXTENSION_V1:${encodedManifest}:END_LYNXTRON_NATIVE_EXTENSION`;

export default createShowcaseConfig({
  lynxDistPath: './output/bundle/lynx',
  sourceDefine: {
    __LYNXTRON_NATIVE_EXTENSION_MANIFEST__: JSON.stringify(marker),
  },
});
