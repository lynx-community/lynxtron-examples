const path = require('node:path');
const { app, LynxWindow } = require('lynxtron');

app.whenReady().then(() => {
  require('./build/system_webview.node');
  const win = new LynxWindow({ title: 'System WebView', width: 680, height: 440 });
  win.show();
  win.loadFile(path.join(__dirname, 'dist/main.lynx.bundle'));
});
