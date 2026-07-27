import { LynxWindow, app, shell } from '@lynx-js/lynxtron';
import path from 'node:path';

// electron native-ui/external-links-file-manager main:
//   ipcMain.on('open-home-dir')  → shell.showItemInFolder(os.homedir())
//   ipcMain.on('open-external')  → shell.openExternal(url)
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'shell:showHome') {
      shell.showItemInFolder(app.getPath('home'));
    } else if (name === 'shell:openExternal') {
      const url = (data as { url?: string })?.url;
      if (url) shell.openExternal(url);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "External Links & File Manager",
};

/**
 * Create this fiddle's window. Exposed as a function rather than inlined
 * because several fiddles open additional windows of themselves (new-window,
 * dock menu), the same way upstream calls `new BrowserWindow()` again.
 */
function createWindow(): LynxWindow {
  const win = new LynxWindow({
    ...WINDOW_OPTIONS,
  } as any);
  setupWindow(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
