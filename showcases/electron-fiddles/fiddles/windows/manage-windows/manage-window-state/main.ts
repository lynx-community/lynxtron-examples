import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import type { Rectangle } from '@lynx-js/lynxtron';
import path from 'node:path';

// Port of electron docs/fiddles windows/manage-windows/manage-window-state.
// Upstream opens a demo window and reports its move/resize bounds back to the
// renderer. Lynxtron exposes the window bounds API directly, so this drives the
// fiddle's OWN window: it replies with live bounds, applies bounds/deltas from
// the UI, and pushes 'bounds-changed' whenever the window is moved or resized.
let mainWindow: LynxWindow | null = null;

const bounds = (): Rectangle | null => mainWindow?.getBounds() ?? null;

const push = () => {
  const b = bounds();
  if (b) mainWindow?.sendGlobalEvent('bounds-changed', b);
};

function registerBridgeHandlers() {
  lynxBridge.handle('window:getBounds', () => bounds());

  lynxBridge.on('window:setBounds', (data) => {
    const b = bounds();
    if (!b) return;
    const d = (data ?? {}) as Partial<Rectangle>;
    mainWindow?.setBounds({
      x: Math.round(d.x ?? b.x),
      y: Math.round(d.y ?? b.y),
      width: Math.round(d.width ?? b.width),
      height: Math.round(d.height ?? b.height),
    });
    push();
  });

  lynxBridge.on('window:nudge', (data) => {
    // Relative move/resize: dx/dy shift position, dw/dh grow/shrink size.
    const b = bounds();
    if (!b) return;
    const nudge = (data ?? {}) as {
      dx?: number;
      dy?: number;
      dw?: number;
      dh?: number;
    };
    mainWindow?.setBounds({
      x: b.x + Math.round(nudge.dx ?? 0),
      y: b.y + Math.round(nudge.dy ?? 0),
      width: Math.max(200, b.width + Math.round(nudge.dw ?? 0)),
      height: Math.max(150, b.height + Math.round(nudge.dh ?? 0)),
    });
    push();
  });
}

const setupWindow = (win: LynxWindow) => {
  // Mirror upstream: report bounds live as the OS window is dragged / resized.
  win.on('move', push);
  win.on('resize', push);
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Manage Window State",
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
  setupWindow(win);
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
