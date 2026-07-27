import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles windows/manage-windows/new-window.
//
// Upstream: the renderer sends a `new-window` IPC message and main does
//   `new BrowserWindow({ width, height }); win.loadURL(url)`.
// Lynxtron windows render Lynx bundles rather than arbitrary web URLs, so
// instead of loading an external site we open a second top-level LynxWindow
// via `ctx.openFiddle(id)` — the launcher owns window creation the same way
// Electron's main process owns `new BrowserWindow()`. We then push a
// confirmation back to the UI so it can report which window it spawned.
export const registerMain: RegisterMain = (win: LynxWindow, ctx) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'new-window') {
      const id = String((data as Record<string, unknown>)?.id ?? 'first-app');
      ctx.openFiddle(id);
      win.sendGlobalEvent('window-opened', { id });
    }
  });
};
