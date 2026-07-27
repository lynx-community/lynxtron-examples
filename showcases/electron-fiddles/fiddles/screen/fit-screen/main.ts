import { LynxWindow, app, screen } from '@lynx-js/lynxtron';
import type { Rectangle } from '@lynx-js/lynxtron';
import path from 'node:path';

interface FitState {
  work: { x: number; y: number; width: number; height: number };
  bounds: Rectangle;
}

// Port of electron docs/fiddles screen/fit-screen. Upstream reads the primary
// display's work area (`screen.getPrimaryDisplay().workAreaSize`) and creates a
// BrowserWindow sized to fill it. Lynxtron exposes the same `screen` API plus
// live `getBounds`/`setBounds`, so this drives THIS window: it reports the work
// area and current bounds, and fits the window to the work area on request.
const setupWindow = (win: LynxWindow) => {
  const workArea = () => {
    const { workArea } = screen.getPrimaryDisplay();
    return {
      x: Math.round(workArea.x),
      y: Math.round(workArea.y),
      width: Math.round(workArea.width),
      height: Math.round(workArea.height),
    };
  };

  const state = (): FitState => ({ work: workArea(), bounds: win.getBounds() });

  const push = () => win.sendGlobalEvent('fit-changed', state());

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'fit:getState') {
      callback.sendReply(state());
    }
  });

  win.on('-lynx-message', (name) => {
    if (name === 'fit:toScreen') {
      // Fill the primary display's available work area (excludes the OS
      // taskbar / dock), mirroring `new BrowserWindow({ width, height })`.
      win.setBounds(workArea());
      push();
    }
  });

  // Keep the reported bounds in sync as the OS window is dragged / resized.
  win.on('move', push);
  win.on('resize', push);
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Fit Window to Screen",
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
