import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles
// features/window-customization/custom-window-styles/frameless-windows.
//
// Upstream main.js is a one-liner: `new BrowserWindow({ frame: false })` loading
// a web page. A frameless window has no OS chrome — no title bar and, crucially,
// none of the OS minimize / maximize / close buttons. In Electron the page then
// has to provide its *own* in-content controls and wire them to the window.
//
// This fiddle's own main.ts constructs its LynxWindow with `frame: false`
// (from the manifest), so the window framing this content is genuinely
// frameless. This main handler is the piece Electron leaves to the app: it turns
// the in-content buttons into real window operations via the LynxWindow API
// (Electron keeps this main-process window API; only the renderer is Lynx now).
let mainWindow: LynxWindow | null = null;

const state = () => {
  let bounds = '(unavailable)';
  let maximized = false;
  try {
    const b = mainWindow?.getBounds();
    if (b) bounds = `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
  } catch {
    // Best-effort — a dropped read just leaves the placeholder.
  }
  try {
    maximized = mainWindow?.isMaximized() ?? false;
  } catch {
    maximized = false;
  }
  return { bounds, maximized };
};

const pushState = () => {
  try {
    mainWindow?.sendGlobalEvent('window-state', state());
  } catch {
    // Best-effort; a dropped update just means one stale readout.
  }
};

function registerBridgeHandlers() {
  // Fire-and-forget window commands from the custom title bar buttons.
  lynxBridge.on('window:minimize', () => {
    try {
      mainWindow?.minimize();
    } catch {
      // Ignore — e.g. close racing with a late message.
    }
  });
  lynxBridge.on('window:maximize', () => {
    try {
      // One button toggles maximize / restore, like a real title-bar control.
      if (mainWindow?.isMaximized()) mainWindow.unmaximize();
      else mainWindow?.maximize();
      pushState();
    } catch {
      // Ignore — e.g. close racing with a late message.
    }
  });
  lynxBridge.on('window:center', () => {
    try {
      mainWindow?.center();
      pushState();
    } catch {
      // Ignore — e.g. close racing with a late message.
    }
  });
  lynxBridge.on('window:close', () => {
    try {
      mainWindow?.close();
    } catch {
      // Ignore — e.g. close racing with a late message.
    }
  });

  // Request/response for the initial state so the UI can render before any event.
  lynxBridge.handle('window:state', () => {
    let platform = 'unknown';
    try {
      platform = (globalThis as any).process?.platform ?? 'unknown';
    } catch {
      platform = 'unknown';
    }
    return { ...state(), platform };
  });
}

const setupWindow = (win: LynxWindow) => {
  // Keep the on-screen readout live as the window moves / resizes / (un)maximizes
  // in response to the in-content controls below.
  try {
    win.on('move', pushState);
    win.on('resize', pushState);
    win.on('maximize', pushState);
    win.on('unmaximize', pushState);
  } catch {
    // Some platforms may not fire every event; the invoke read still populates.
  }
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Frameless Window",
  frame: false,
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
