import { LynxWindow, app, dialog, shell, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import * as fs from 'node:fs';

// Port of electron docs/fiddles features/drag-and-drop.
//
// Upstream drags an OS file OUT of the window using the HTML5 drag API +
// event.sender.startDrag(). Lynx has no HTML5 drag-and-drop, so this ports the
// "files in" side as the nearest runnable demo: pick a file with a native
// dialog (stand-in for a drop), report its info, then reveal it in the OS file
// manager with shell.showItemInFolder — the inverse of dragging a file out.

interface DroppedFile {
  path: string;
  name: string;
  size: number;
}

function registerBridgeHandlers() {
  lynxBridge.handle('dnd:pickFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    const filePath = filePaths[0];
    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch {
      size = 0;
    }
    const file: DroppedFile = {
      path: filePath,
      name: path.basename(filePath),
      size,
    };
    return file;
  });

  lynxBridge.on('dnd:reveal', (data) => {
    const payload = data as { path?: string } | undefined;
    const filePath = String(payload?.path ?? '');
    if (filePath) shell.showItemInFolder(filePath);
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Drag & Drop (files in)",
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
