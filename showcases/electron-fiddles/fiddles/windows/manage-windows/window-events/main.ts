import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles windows/manage-windows/window-events.
//
// Upstream opens a SECOND demo window and listens for that window's
// focus / blur / close events, toggling a "Focus on Demo" button in the
// renderer. Lynxtron's confirmed API listens for lifecycle events on the
// fiddle's OWN LynxWindow (focus / blur / maximize / unmaximize / minimize /
// restore / move / resize), so this adaptation subscribes to those and pushes
// each one to the UI via `win.sendGlobalEvent` — the same "events observed in
// main, forwarded to the UI" pattern the original demonstrates.
const setupWindow = (win: LynxWindow) => {
  // Forward a named window event to the UI. `detail` carries any extra info
  // (e.g. bounds for move/resize) so the log line can be descriptive.
  const push = (type: string, detail?: string) => {
    try {
      win.sendGlobalEvent('window-event', { type, detail: detail ?? '', at: Date.now() });
    } catch {
      // Best-effort; a dropped event just means one missing log line.
    }
  };

  const bounds = (): string | undefined => {
    try {
      const b = win.getBounds();
      if (!b) return undefined;
      return `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
    } catch {
      return undefined;
    }
  };

  // Bind each lifecycle event explicitly so the literal event name matches the
  // typed LynxWindow overloads. A given platform may not fire every one, so
  // guard each subscription.
  const bind = (event: string, listener: () => void) => {
    try {
      win.on(event as never, listener);
    } catch {
      // Skip unsupported events silently.
    }
  };

  bind('focus', () => push('focus'));
  bind('blur', () => push('blur'));
  bind('maximize', () => push('maximize'));
  bind('unmaximize', () => push('unmaximize'));
  bind('minimize', () => push('minimize'));
  bind('restore', () => push('restore'));
  bind('move', () => push('move', bounds()));
  bind('resize', () => push('resize', bounds()));

  // Let the UI request the current bounds on mount so the log starts populated.
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'window:getBounds') {
      callback.sendReply(bounds() ?? '(unavailable)');
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Window Events",
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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
