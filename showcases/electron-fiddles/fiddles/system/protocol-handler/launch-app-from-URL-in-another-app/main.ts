import { LynxWindow, app, shell } from '@lynx-js/lynxtron';
import path from 'node:path';

const SCHEME = 'electron-fiddle';

// electron system/protocol-handler main: register a custom URL scheme and push
// incoming deep links to the UI.
//   app.setAsDefaultProtocolClient(scheme)   ← claim `electron-fiddle://`
//   app.on('open-url', (e, url) => …)        ← macOS deep-link delivery
// Electron shows the url in a dialog.showErrorBox; here we forward it to the UI
// via win.sendGlobalEvent so it renders inline (matches Lynxtron's push model).
const setupWindow = (win: LynxWindow) => {
  const pushLink = (url: string) => win.sendGlobalEvent('deep-link', url);

  // Deliver real deep links (fires only when packaged & registered with the OS).
  try {
    app.on('open-url', (_event: unknown, url: string) => pushLink(url));
  } catch {
    // best-effort: some platforms/builds may not emit 'open-url'.
  }

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'protocol:register') {
      let ok = false;
      try {
        ok = app.setAsDefaultProtocolClient(SCHEME) !== false;
      } catch {
        ok = false;
      }
      callback.sendReply(ok);
    }
  });

  win.on('-lynx-message', (name, data) => {
    const payload = data as Record<string, unknown> | undefined;
    if (name === 'protocol:open-external') {
      const url = String(payload?.url ?? '');
      if (url) shell.openExternal(url);
    } else if (name === 'protocol:simulate') {
      // Inject a deep link so the demo is testable without a packaged build.
      pushLink(String(payload?.url ?? `${SCHEME}://open`));
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Protocol Handler (deep link)",
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
