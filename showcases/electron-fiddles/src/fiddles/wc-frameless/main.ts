import { type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles
// features/window-customization/custom-window-styles/frameless-windows.
//
// Upstream main.js is a one-liner: `new BrowserWindow({ frame: false })` loading
// a web page. A frameless window has no OS chrome — no title bar and, crucially,
// none of the OS minimize / maximize / close buttons. In Electron the page then
// has to provide its *own* in-content controls and wire them to the window.
//
// The launcher already constructs THIS fiddle's LynxWindow with `frame: false`
// (from the manifest), so the window framing this content is genuinely
// frameless. This main handler is the piece Electron leaves to the app: it turns
// the in-content buttons into real window operations via the LynxWindow API
// (Electron keeps this main-process window API; only the renderer is Lynx now).
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const state = () => {
    let bounds = '(unavailable)';
    let maximized = false;
    try {
      const b = win.getBounds();
      if (b) bounds = `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
    } catch {
      // Best-effort — a dropped read just leaves the placeholder.
    }
    try {
      maximized = win.isMaximized();
    } catch {
      maximized = false;
    }
    return { bounds, maximized };
  };

  const pushState = () => {
    try {
      win.sendGlobalEvent('window-state', state());
    } catch {
      // Best-effort; a dropped update just means one stale readout.
    }
  };

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

  // Fire-and-forget window commands from the custom title bar buttons.
  win.on('-lynx-message', (name) => {
    try {
      if (name === 'window:minimize') {
        win.minimize();
      } else if (name === 'window:maximize') {
        // One button toggles maximize / restore, like a real title-bar control.
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
        pushState();
      } else if (name === 'window:center') {
        win.center();
        pushState();
      } else if (name === 'window:close') {
        win.close();
      }
    } catch {
      // Ignore — e.g. close racing with a late message.
    }
  });

  // Request/response for the initial state so the UI can render before any event.
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'window:state') {
      let platform = 'unknown';
      try {
        platform = (globalThis as any).process?.platform ?? 'unknown';
      } catch {
        platform = 'unknown';
      }
      callback.sendReply({ ...state(), platform });
    }
  });
};
