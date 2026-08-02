import { LynxWindow, Menu, app, shell, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles menus/dock-menu.
// Upstream builds a dock menu from a template and installs it with
// `app.dock.setMenu(...)`. The menu has three items: New Window (opens another
// window), Close All Windows, and Open Docs (shell.openExternal).
//
// Lynxtron keeps Electron's `app.dock` API. It is macOS-only, so `app.dock` is
// undefined on Windows / Linux — we guard for that and report availability to
// the UI. Because a dock menu is only reachable by right-clicking the dock icon,
// we also mirror every item as a bridge handler so the fiddle is drivable
// entirely from its window.
const DOCS_URL = 'https://lynxjs.org';

let mainWindow: LynxWindow | null = null;
let dockAvailable = false;

const newWindow = () => createWindow();
const closeAllWindows = () => mainWindow?.close?.();
const openDocs = () => shell.openExternal(DOCS_URL);

function setupDock() {
  const dockMenu = Menu.buildFromTemplate([
    { label: 'New Window', click: newWindow },
    { label: 'Close All Windows', click: closeAllWindows },
    { label: 'Open Lynx Docs', click: openDocs },
    // add more menu options to the array
  ]);

  // `app.dock` is only defined on macOS. Track whether the menu was installed
  // so the UI can explain the gap on other platforms.
  try {
    if (app.dock) {
      app.dock.setMenu(dockMenu);
      dockAvailable = true;
    }
  } catch {
    // setMenu is best-effort; the in-UI buttons still drive the demo.
  }
}

function registerBridgeHandlers() {
  lynxBridge.handle('dock:state', () => ({ dockAvailable, docsUrl: DOCS_URL }));

  // Mirror each dock-menu item so the window buttons drive the same actions.
  lynxBridge.on('dock:newWindow', () => {
    newWindow();
  });
  lynxBridge.on('dock:closeAll', () => {
    closeAllWindows();
  });
  lynxBridge.on('dock:openDocs', () => {
    openDocs();
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Dock Menu (macOS)",
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
  setupDock();
  registerBridgeHandlers();
  createWindow();
});
