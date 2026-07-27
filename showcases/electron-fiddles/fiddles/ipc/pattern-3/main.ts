import { LynxWindow, Menu, app } from '@lynx-js/lynxtron';
import path from 'node:path';

// electron ipc/pattern-3 main: application menu items send 'update-counter' to
// the renderer; renderer echoes the value back via 'counter-value'.
const setupWindow = (win: LynxWindow) => {
  const push = (delta: number) => win.sendGlobalEvent('update-counter', delta);

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

  win.on('-lynx-message', (name, data) => {
    if (name === 'nudge') {
      push(Number((data as Record<string, unknown>)?.delta ?? 0));
    } else if (name === 'counter-value') {
      // Electron logs the echoed value to the Node console.
      // eslint-disable-next-line no-console
      console.log('[ipc-pattern-3] counter-value =', (data as Record<string, unknown>)?.value);
    }
  });
};

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
  setupWindow(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
