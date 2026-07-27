import { LynxWindow, Menu, app } from '@lynx-js/lynxtron';
import path from 'node:path';

// Port of electron docs/fiddles menus/context-menu/dom.
// Upstream: the renderer listens for the DOM `contextmenu` (right-click) event
// on a specific element, calls `event.preventDefault()`, and sends a
// `context-menu` IPC message. Main pops up a native Menu (copy/cut/paste/
// selectall) anchored to the window.
//
// Lynxtron adaptation: Lynx has no `contextmenu` event, so the UI long-presses
// a specific element (`bindlongpress`) and fires `bridgeSend('context-menu')`.
// Main builds the same role-based Menu and pops it up at the window.
const setupWindow = (win: LynxWindow) => {
  const menu = Menu.buildFromTemplate([
    { role: 'copy' },
    { role: 'cut' },
    { role: 'paste' },
    { role: 'selectall' },
  ]);

  const popup = () => {
    try {
      menu.popup({ window: win });
    } catch {
      // popup is best-effort — nothing to surface if the platform declines it.
    }
  };

  // Long-press the target element → open the native context menu for it.
  win.on('-lynx-message', (name) => {
    if (name === 'context-menu') popup();
  });

  // Same handler as an invoke so the UI can confirm the popup fired.
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'context-menu') {
      popup();
      callback.sendReply(true);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Context Menu (element-targeted)",
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
