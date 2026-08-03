import { LynxWindow, Menu, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// electron ipc/pattern-3 main: application menu items send 'update-counter' to
// the renderer; renderer echoes the value back via 'counter-value'.
let mainWindow: LynxWindow | null = null;

const push = (delta: number) => mainWindow?.sendGlobalEvent('update-counter', delta);

function setupMenu() {
  try {
    const menu = Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          { label: 'Increment', click: () => push(1) },
          { label: 'Decrement', click: () => push(-1) },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } catch {
    // Application menu is best-effort; the in-UI buttons still drive the demo.
  }
}

function registerBridgeHandlers() {
  lynxBridge.on('nudge', (data) => {
    push(Number((data as Record<string, unknown>)?.delta ?? 0));
  });
  lynxBridge.on('counter-value', (data) => {
    // Electron logs the echoed value to the Node console.
    // eslint-disable-next-line no-console
    console.log('[ipc-pattern-3] counter-value =', (data as Record<string, unknown>)?.value);
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "IPC: Main → Renderer",
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
  setupMenu();
  registerBridgeHandlers();
  createWindow();
});
