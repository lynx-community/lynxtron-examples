import { LynxWindow, Menu, Tray, app, nativeImage, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import type { MenuItem } from '@lynx-js/lynxtron';
import path from 'node:path';

// Port of electron docs/fiddles menus/tray-menu.
// A Tray icon with a context Menu built from a template. The template mirrors
// the upstream: Open App (focus window), Set Green Icon (checkbox → red/green),
// Set Title (checkbox → tray title), Quit.
//
// Keep a reference to the Tray globally so it is not garbage collected.
let tray: Tray | null = null;
let mainWindow: LynxWindow | null = null;

// Same red / green 16×16 icons the Electron fiddle ships (base64 data URLs).
const RED_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII=';
const GREEN_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACOSURBVHgBpZLRDYAgEEOrEzgCozCCGzkCbKArOIlugJvgoRAUNcLRpvGH19TkgFQWkqIohhK8UEaKwKcsOg/+WR1vX+AlA74u6q4FqgCOSzwsGHCwbKliAF89Cv89tWmOT4VaVMoVbOBrdQUz+FrD6XItzh4LzYB1HFJ9yrEkZ4l+wvcid9pTssh4UKbPd+4vED2Nd54iAAAAAElFTkSuQmCC';

// Track checkbox state so the UI can reflect it.
let isGreen = false;
let hasTitle = false;

let red: ReturnType<typeof nativeImage.createFromDataURL> | null = null;
let green: ReturnType<typeof nativeImage.createFromDataURL> | null = null;
let contextMenu: ReturnType<typeof Menu.buildFromTemplate> | null = null;

const applyIcon = () => tray?.setImage((isGreen ? green : red)!);
const applyTitle = () => tray?.setTitle(hasTitle ? 'Title' : '');
const pushState = () =>
  mainWindow?.sendGlobalEvent('tray-state', { isGreen, hasTitle });

function setupTray() {
  red = nativeImage.createFromDataURL(RED_URL);
  green = nativeImage.createFromDataURL(GREEN_URL);

  try {
    tray = new Tray(red);
    tray.setToolTip('Tray Icon Demo');
  } catch {
    // Tray creation is best-effort; the in-UI buttons still drive the demo.
  }

  contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open App',
      click: () => mainWindow?.focus(),
    },
    {
      label: 'Set Green Icon',
      type: 'checkbox',
      click: (item: MenuItem) => {
        isGreen = !!item.checked;
        applyIcon();
        pushState();
      },
    },
    {
      label: 'Set Title',
      type: 'checkbox',
      click: (item: MenuItem) => {
        hasTitle = !!item.checked;
        applyTitle();
        pushState();
      },
    },
    { role: 'quit' },
  ]);

  tray?.setContextMenu(contextMenu);
}

function registerBridgeHandlers() {
  lynxBridge.handle('tray:popup', () => {
    // Pop the same context menu at the window so the demo is reachable
    // without a physical tray click.
    try {
      if (mainWindow && contextMenu) contextMenu.popup({ window: mainWindow });
    } catch {
      // popup is best-effort.
    }
    return { isGreen, hasTitle };
  });
  lynxBridge.handle('tray:state', () => ({ isGreen, hasTitle }));

  // Mirror each context-menu item so the UI buttons drive the real Tray.
  lynxBridge.on('tray:openApp', () => {
    mainWindow?.focus();
  });
  lynxBridge.on('tray:toggleIcon', () => {
    isGreen = !isGreen;
    applyIcon();
    pushState();
  });
  lynxBridge.on('tray:toggleTitle', () => {
    hasTitle = !hasTitle;
    applyTitle();
    pushState();
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Tray Menu",
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
  setupTray();
  registerBridgeHandlers();
  createWindow();
});
