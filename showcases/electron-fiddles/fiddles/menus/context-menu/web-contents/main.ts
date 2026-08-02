import { LynxWindow, Menu, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles menus/context-menu/web-contents.
//
// Upstream built a Menu (copy / cut / paste / selectAll) and popped it up from
// `win.webContents.on('context-menu')` — but only when `params.isEditable` was
// true (i.e. the target was the <textarea>). Lynxtron has no `webContents`, so
// the "context-menu" gesture is raised from the Lynx UI (long-press / a button)
// which calls into main with an `isEditable` flag. Main keeps the exact same
// Menu and the same editable-only gate, then pops it with `Menu.popup`.
let mainWindow: LynxWindow | null = null;

const menu = Menu.buildFromTemplate([
  { role: 'copy' },
  { role: 'cut' },
  { role: 'paste' },
  { role: 'selectAll' },
]);

function registerBridgeHandlers() {
  lynxBridge.handle('contextmenu:popup', (_event, data) => {
    // Mirror upstream: only show the context menu if the element is editable.
    const isEditable = !!(data as { isEditable?: boolean } | undefined)?.isEditable;
    let shown = false;
    if (isEditable) {
      try {
        if (mainWindow) {
          menu.popup({ window: mainWindow });
          shown = true;
        }
      } catch {
        // popup is best-effort in headless / preview environments.
      }
    }
    return { shown, isEditable };
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Context Menu",
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
