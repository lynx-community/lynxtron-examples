import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles windows/manage-windows/new-window.
//
// Upstream: the renderer sends a `new-window` IPC message and main does
//   `new BrowserWindow({ width, height }); win.loadURL(url)`.
// Lynxtron windows render Lynx bundles rather than arbitrary web URLs, so
// instead of loading an external site we open a second top-level LynxWindow
// via `createWindow()` — this fiddle owns window creation the same way
// Electron's main process owns `new BrowserWindow()`. We then push a
// confirmation back to the UI so it can report which window it spawned.
const setupWindow = (win: LynxWindow) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'new-window') {
      const id = String((data as Record<string, unknown>)?.id ?? 'first-app');
      createWindow();
      win.sendGlobalEvent('window-opened', { id });
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "New Window",
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
