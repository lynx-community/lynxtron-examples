import { dialog, shell, type LynxWindow } from '@lynx-js/lynxtron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RegisterMain } from '../../main/desktop/registry';

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

export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dnd:pickFile') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
      });
      if (canceled || filePaths.length === 0) {
        callback.sendReply(null);
        return;
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
      callback.sendReply(file);
    }
  });

  win.on('-lynx-message', (name, data) => {
    const payload = data as { path?: string } | undefined;
    if (name === 'dnd:reveal') {
      const filePath = String(payload?.path ?? '');
      if (filePath) shell.showItemInFolder(filePath);
    }
  });
};
