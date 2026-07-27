import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles windows/manage-windows/frameless-window.
//
// Upstream: the renderer sends a `create-frameless-window` IPC message and main
// does `new BrowserWindow({ frame: false }); win.loadURL(url)` — a window with
// no OS chrome (title bar / borders) loading a data: URL.
// Lynxtron windows render Lynx bundles rather than arbitrary web URLs, so
// instead of loading a data URL we open a second top-level LynxWindow via
// `ctx.openFiddle('window-frameless')`. That fiddle is registered with
// `window: { frame: false }`, so the launcher constructs it as a genuinely
// frameless `new LynxWindow({ frame: false })` — the same window-creation the
// main process owns in Electron. We push a confirmation back to the UI.
export const registerMain: RegisterMain = (win: LynxWindow, ctx) => {
  win.on('-lynx-message', (name) => {
    if (name === 'create-frameless-window') {
      ctx.openFiddle('window-frameless');
      win.sendGlobalEvent('frameless-window-opened', {});
    }
  });
};
