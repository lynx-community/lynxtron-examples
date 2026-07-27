import { LynxWindow, Menu, app, shell } from '@lynx-js/lynxtron';
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

const setupWindow = (win: LynxWindow) => {
  const newWindow = () => createWindow();
  const closeAllWindows = () => win.close?.();
  const openDocs = () => shell.openExternal(DOCS_URL);

  const dockMenu = Menu.buildFromTemplate([
    { label: 'New Window', click: newWindow },
    { label: 'Close All Windows', click: closeAllWindows },
    { label: 'Open Lynx Docs', click: openDocs },
    // add more menu options to the array
  ]);

  // `app.dock` is only defined on macOS. Track whether the menu was installed
  // so the UI can explain the gap on other platforms.
  let dockAvailable = false;
  try {
    if (app.dock) {
      app.dock.setMenu(dockMenu);
      dockAvailable = true;
    }
  } catch {
    // setMenu is best-effort; the in-UI buttons still drive the demo.
  }

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dock:state') {
      callback.sendReply({ dockAvailable, docsUrl: DOCS_URL });
    }
  });

  win.on('-lynx-message', (name) => {
    // Mirror each dock-menu item so the window buttons drive the same actions.
    if (name === 'dock:newWindow') {
      newWindow();
    } else if (name === 'dock:closeAll') {
      closeAllWindows();
    } else if (name === 'dock:openDocs') {
      openDocs();
    }
  });
};

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
  setupWindow(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
