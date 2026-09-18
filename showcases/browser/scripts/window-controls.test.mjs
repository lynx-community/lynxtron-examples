import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

test('maximize bridge uses native state and native restore, including OS changes', async () => {
  const handlers = new Map();
  const calls = [];
  let maximized = false;
  let ready;
  class Window {
    on(name, handler) { handlers.set(name, handler); }
    isMaximized() { return maximized; }
    maximize() { calls.push('maximize'); maximized = true; }
    unmaximize() { calls.push('unmaximize'); maximized = false; }
    setSize() { assert.fail('Maximize toggle must not manually resize'); }
    getSize() { assert.fail('Native restore owns saved bounds'); }
    show() {}
    loadFile() {}
  }
  const source = fs.readFileSync(new URL('../src/main/desktop/main.ts', import.meta.url), 'utf8');
  // Execute the actual host bridge with only external/native imports replaced.
  const code = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''));
  runInNewContext(code, {
    app: { whenReady: () => ({ then: callback => { ready = Promise.resolve().then(callback); } }) },
    LynxWindow: Window, dialog: {}, path, __dirname: '/browser',
    process: { platform: 'darwin' }, LYNX_BUNDLE_PATH: '/browser/main.lynx.bundle',
    require: name => { assert.equal(name, '@lynx-js/cef-webview/lynxtron'); return { initialize() {} }; },
    console: { log() {} },
  });
  await ready;
  let replies = 0;
  const click = () => handlers.get('-lynx-invoke')({ sendReply(value) {
    assert.equal(value, null); replies++;
  } }, 'maximizeWindow', {});
  click();
  click();
  assert.deepEqual(calls, ['maximize', 'unmaximize']);
  maximized = true; // Maximized externally, not through our bridge.
  click();
  assert.equal(calls.at(-1), 'unmaximize');
  click();
  maximized = false; // Restored externally while our last action was maximize.
  click();
  assert.deepEqual(calls, ['maximize', 'unmaximize', 'unmaximize', 'maximize', 'maximize']);
  assert.equal(replies, 5);
});
