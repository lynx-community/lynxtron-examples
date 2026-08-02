import { LynxWindow, Menu, app, dialog, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles menus/shortcuts.
//
// Upstream registers a *global* shortcut (CommandOrControl+Alt+K) with
// globalShortcut.register that pops a "Success!" message box. Lynxtron does not
// export globalShortcut, so the accelerator is attached to an application-menu
// item instead via Menu.setApplicationMenu — the item carries the same
// accelerator and fires the same dialog when its key combo is pressed or the
// menu item is clicked. A bridged `shortcut:fire` makes the same action
// reachable from the in-app button so the demo works without menu focus.
const ACCELERATOR = 'CommandOrControl+Alt+K';

function showSuccess() {
  return dialog.showMessageBox({
    type: 'info',
    message: 'Success!',
    detail: 'You pressed the registered shortcut keybinding.',
    buttons: ['OK'],
  });
}

function setupMenu() {
  try {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Shortcuts',
        submenu: [
          {
            label: 'Trigger Success',
            accelerator: ACCELERATOR,
            click: () => {
              showSuccess();
            },
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } catch {
    // Menu install is best-effort; the in-UI button still drives the demo.
  }
}

function registerBridgeHandlers() {
  lynxBridge.handle('shortcut:fire', async () => {
    // Mirror the accelerator action so the UI button is reachable without
    // menu keyboard focus.
    const { response } = await showSuccess();
    return response;
  });
  lynxBridge.handle('shortcut:accelerator', () => ACCELERATOR);
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Menu Shortcuts",
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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  setupMenu();
  registerBridgeHandlers();
  createWindow();
});
