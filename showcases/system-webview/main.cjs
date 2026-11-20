const fs = require('node:fs');
const path = require('node:path');
const { app, LynxWindow } = require('lynxtron');

// The package runs from its own root (`lynxtron .`, website example) and from
// the assembled showcase directory (`lynxtron ./dist/desktop`), which keeps the
// bundle next to this file instead of under `dist/`.
const bundlePath = [
  path.join(__dirname, 'main.lynx.bundle'),
  path.join(__dirname, 'dist', 'main.lynx.bundle'),
].find((candidate) => fs.existsSync(candidate));

app.whenReady().then(() => {
  require(path.join(__dirname, 'build', 'system_webview.node'));
  const win = new LynxWindow({ title: 'System WebView', width: 1200, height: 800 });
  win.show();
  win.loadFile(bundlePath);
});
