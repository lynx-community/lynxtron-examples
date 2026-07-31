import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron ipc/pattern-1 main: ipcMain.on('set-title') → win.setTitle().
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'set-title') {
      const title = String((data as Record<string, unknown>)?.title ?? '');
      win.setTitle(title);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "IPC: Renderer → Main (one-way)",
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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
