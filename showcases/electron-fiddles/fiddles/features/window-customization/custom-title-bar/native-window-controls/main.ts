import { LynxWindow, app } from '@lynx-js/lynxtron';
import path from 'node:path';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// native-window-controls.
//
// Upstream creates a BrowserWindow with `titleBarStyle: 'hidden'` (removes the
// default OS title bar) plus, on Windows/Linux, `titleBarOverlay: true` (keeps
// the native minimize / maximize / close controls painted into the window).
// The result is a window with no title bar strip but with the native traffic-
// light / control buttons still present.
//
// In Lynxtron this fiddle's main.ts already constructs this fiddle's LynxWindow with
// `{ titleBarStyle: 'hidden' }` (declared in the manifest), so the chrome is
// applied for us — there is no title bar to remove from the UI, and the native
// controls remain. Main only serves live facts the UI can display to prove the
// window is a genuine, movable/resizable window: the platform (so the UI can
// explain whether it shows macOS traffic lights or a Windows/Linux overlay) and
// the current bounds (updated on move/resize).
const setupWindow = (win: LynxWindow) => {
  const bounds = () => {
    try {
      const b = win.getBounds();
      if (!b) return '(unavailable)';
      return `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
    } catch {
      return '(unavailable)';
    }
  };

  const pushBounds = () => {
    try {
      win.sendGlobalEvent('window-bounds', { bounds: bounds() });
    } catch {
      // Best-effort; a dropped update just means one stale readout.
    }
  };

  // Keep the on-screen bounds readout live as the user drags / resizes the
  // window using the native controls + edges.
  try {
    win.on('move' as any, pushBounds);
    win.on('resize' as any, pushBounds);
  } catch {
    // Platform may not fire these; the initial read below still populates.
  }

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'controls:info') {
      let platform = 'unknown';
      try {
        // process.platform is available in the main process.
        platform = (globalThis as any).process?.platform ?? 'unknown';
      } catch {
        platform = 'unknown';
      }
      let name_ = '';
      try {
        name_ = app.getName();
      } catch {
        name_ = '';
      }
      callback.sendReply({ platform, appName: name_, bounds: bounds() });
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Native Window Controls",
  titleBarStyle: 'hidden',
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
