import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import fs from 'node:fs/promises';

// Port of electron docs/fiddles features/recent-documents.
// Upstream wrote `recently-used.md` next to main.js and called
// app.addRecentDocument(path) on startup, then app.clearRecentDocuments()
// on window-all-closed. Here we drive both from the UI via the bridge.
function registerBridgeHandlers() {
  lynxBridge.handle('recent:add', async (_event, data) => {
    const fileName = String(
      (data as Record<string, unknown>)?.fileName ?? 'recently-used.md',
    );
    // Write into a real, user-facing location so the OS can resolve it.
    const dir = app.getPath('documents');
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, 'Lorem Ipsum');
    app.addRecentDocument(filePath);
    return filePath;
  });
  lynxBridge.handle('recent:clear', () => {
    app.clearRecentDocuments();
    return true;
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Recent Documents",
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
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
