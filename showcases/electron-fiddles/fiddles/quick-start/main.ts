import { LynxWindow, app } from '@lynx-js/lynxtron';
import path from 'node:path';



const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Quick Start",
};

/**
 * Create this fiddle's window. Exposed as a function rather than inlined
 * because several fiddles open additional windows of themselves (new-window,
 * dock menu), the same way upstream calls `new BrowserWindow()` again.
 */
function createWindow(): LynxWindow {
  const win = new LynxWindow({
    ...WINDOW_OPTIONS,
    lynxPreference: { preload: path.join(__dirname, 'preload.js') },
  } as any);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
