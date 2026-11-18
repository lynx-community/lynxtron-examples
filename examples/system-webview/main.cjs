const path = require('node:path');
const { app, LynxWindow } = require('lynxtron');

app.whenReady().then(() => {
  require('./build/system_webview.node');
  const win = new LynxWindow({ title: 'System WebView', width: 1200, height: 800 });
  win.show();
  win.loadFile(path.join(__dirname, 'dist/main.lynx.bundle'));
});
