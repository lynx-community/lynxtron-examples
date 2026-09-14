const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const extension = path.join(__dirname, 'native-texture-extension');
const manifest = require('./native-texture-extension/lynx.lib.json');

test('manifest declares literal supported platform artifacts and an AutoLink entry', () => {
  const pkg = require('./native-texture-extension/package.json');
  assert.equal(pkg.exports['./lynxtron'], './index.cjs');
  assert.deepEqual(manifest.platforms.lynxtron.targets.map(t => [t.os, t.arch]),
    [['darwin', 'arm64'], ['win32', 'x64']]);
  for (const target of manifest.platforms.lynxtron.targets) {
    assert.deepEqual(target.files, ['build/Release/native_texture_canvas_module.node']);
  }
});

test('AutoLink entry registers immediately and repeated preview setup is idempotent', () => {
  let registrations = 0;
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(extension, 'index.cjs'), 'utf8'), {
    __dirname: extension, exports,
    require: name => name === 'fs' ? { existsSync: () => true }
      : name === 'path' ? path
      : { createExtensionModule: () => ({ name: 'Canvas', creatorModuleFunc: {}, isLazyCreate: false, opaque: null }) },
    process: { _linkedBinding: () => ({ registerGlobalEnvModule: () => { registrations++; } }) },
  });
  assert.equal(registrations, 1);
  assert.equal(exports.setUp(), true);
  assert.equal(registrations, 1);
});

test('missing native artifact fails loudly instead of rendering an unregistered canvas', () => {
  assert.throws(() => vm.runInNewContext(fs.readFileSync(path.join(extension, 'index.cjs'), 'utf8'), {
    __dirname: extension, exports: {},
    require: name => name === 'fs' ? { existsSync: () => false } : path,
  }), /run build:native-texture first/);
});

test('production build stages the manifest, entry and selected binary without manual copies', () => {
  const staged = path.join(__dirname, 'dist/desktop/.lynxtron/native/node_modules/lynxtron-native-texture-canvas');
  for (const file of ['index.cjs', 'package.json', 'lynx.lib.json', ...manifest.platforms.lynxtron.targets[0].files]) {
    assert.ok(fs.existsSync(path.join(staged, file)), `Missing ${file}; run build before this test`);
  }
  assert.equal(fs.readFileSync(path.join(staged, 'index.cjs'), 'utf8'), fs.readFileSync(path.join(extension, 'index.cjs'), 'utf8'));
  const installed = path.dirname(require.resolve('lynxtron-native-texture-canvas/package.json'));
  const binary = 'build/Release/native_texture_canvas_module.node';
  assert.deepEqual(fs.readFileSync(path.join(staged, binary)), fs.readFileSync(path.join(installed, binary)),
    'AutoLink must stage the binary built in the installed dependency');
  assert.ok(!fs.existsSync(path.join(__dirname, 'dist/desktop/node_modules/lynxtron-native-texture-canvas')));
});
