import { app, devtool, LynxWindow } from '@lynx-js/lynxtron';
import path from 'path';

app.whenReady().then(() => {
  try { devtool.setDevToolEnabled(true); } catch (e) { console.warn('devtool.setDevToolEnabled failed:', e); }
  const win = new LynxWindow({
    width: 800,
    height: 600,
    title: 'Hello Lynxtron',
  });

  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
});
