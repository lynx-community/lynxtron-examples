import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entrySource = fs.readFileSync(
  path.resolve(__dirname, '../index.cjs'),
  'utf8',
);

function loadEntry({ platform, arch, manifest }) {
  const module = { exports: {} };
  const loadedPaths = [];
  const registrations = [];
  const context = {
    __dirname:
      platform === 'win32'
        ? 'C:\\native-texture-extension'
        : '/native-texture-extension',
    module,
    exports: module.exports,
    process: {
      platform,
      arch,
      _linkedBinding() {
        return {
          registerGlobalEnvModule(...args) {
            registrations.push(args);
          },
        };
      },
    },
    require(specifier) {
      if (specifier === 'fs') {
        return { existsSync: () => true };
      }
      if (specifier === 'path') {
        return platform === 'win32' ? path.win32 : path.posix;
      }
      if (specifier === './lynx.lib.json') {
        return manifest;
      }
      loadedPaths.push(specifier);
      return {
        createExtensionModule() {
          return {
            name: 'native-texture-canvas',
            creatorModuleFunc: () => {},
            isLazyCreate: false,
            opaque: null,
          };
        },
      };
    },
  };

  vm.runInNewContext(entrySource, context, { filename: 'index.cjs' });
  return { entry: module.exports, loadedPaths, registrations };
}

test('loads and registers the Windows x64 binary selected by lynx.lib.json', () => {
  const { entry, loadedPaths, registrations } = loadEntry({
    platform: 'win32',
    arch: 'x64',
    manifest: {
      platforms: {
        lynxtron: {
          binaries: [
            {
              os: 'darwin',
              arch: 'arm64',
              path: 'build/Release/native_texture_canvas_module.node',
            },
            {
              os: 'win32',
              arch: 'x64',
              path: 'build/Release/native_texture_canvas_module.node',
            },
          ],
        },
      },
    },
  });

  assert.deepEqual(loadedPaths, [
    'C:\\native-texture-extension\\build\\Release\\native_texture_canvas_module.node',
  ]);
  assert.equal(entry.registered, true);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0][0], 'native-texture-canvas');
});

test('fails clearly when the manifest has no matching Windows binary', () => {
  assert.throws(
    () =>
      loadEntry({
        platform: 'win32',
        arch: 'x64',
        manifest: {
          platforms: {
            lynxtron: {
              binaries: [
                {
                  os: 'darwin',
                  arch: 'arm64',
                  path: 'build/Release/native_texture_canvas_module.node',
                },
              ],
            },
          },
        },
      }),
    /does not provide a binary for win32\/x64/,
  );
});
