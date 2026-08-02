import { LynxWindow, Menu, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
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
let mainWindow: LynxWindow | null = null;

const menu = Menu.buildFromTemplate([
  { role: 'copy' },
  { role: 'cut' },
  { role: 'paste' },
  { role: 'selectall' },
]);

const popup = () => {
  try {
    if (mainWindow) menu.popup({ window: mainWindow });
  } catch {
    // popup is best-effort — nothing to surface if the platform declines it.
  }
};

function registerBridgeHandlers() {
  // Long-press the target element → open the native context menu for it.
  lynxBridge.on('context-menu', () => popup());

  // Same handler as an invoke so the UI can confirm the popup fired.
  lynxBridge.handle('context-menu', () => {
    popup();
    return true;
  });
}

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
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
