import { LynxWindow, app, shell, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

const SCHEME = 'electron-fiddle';

// electron system/protocol-handler main: register a custom URL scheme and push
// incoming deep links to the UI.
//   app.setAsDefaultProtocolClient(scheme)   ← claim `electron-fiddle://`
//   app.on('open-url', (e, url) => …)        ← macOS deep-link delivery
// Electron shows the url in a dialog.showErrorBox; here we forward it to the UI
// via win.sendGlobalEvent so it renders inline (matches Lynxtron's push model).
let mainWindow: LynxWindow | null = null;

const pushLink = (url: string) => mainWindow?.sendGlobalEvent('deep-link', url);

function registerBridgeHandlers() {
  // Deliver real deep links (fires only when packaged & registered with the OS).
  try {
    app.on('open-url', (_event: unknown, url: string) => pushLink(url));
  } catch {
    // best-effort: some platforms/builds may not emit 'open-url'.
  }

  lynxBridge.handle('protocol:register', () => {
    try {
      return app.setAsDefaultProtocolClient(SCHEME) !== false;
    } catch {
      return false;
    }
  });

  lynxBridge.on('protocol:open-external', (data) => {
    const payload = data as Record<string, unknown> | undefined;
    const url = String(payload?.url ?? '');
    if (url) shell.openExternal(url);
  });

  lynxBridge.on('protocol:simulate', (data) => {
    // Inject a deep link so the demo is testable without a packaged build.
    const payload = data as Record<string, unknown> | undefined;
    pushLink(String(payload?.url ?? `${SCHEME}://open`));
  });
}

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
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
