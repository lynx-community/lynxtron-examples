import fs from 'node:fs/promises';
import path from 'node:path';
import { app, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles features/recent-documents.
// Upstream wrote `recently-used.md` next to main.js and called
// app.addRecentDocument(path) on startup, then app.clearRecentDocuments()
// on window-all-closed. Here we drive both from the UI via the bridge.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'recent:add') {
      const fileName = String(
        (data as Record<string, unknown>)?.fileName ?? 'recently-used.md',
      );
      // Write into a real, user-facing location so the OS can resolve it.
      const dir = app.getPath('documents');
      const filePath = path.join(dir, fileName);
      await fs.writeFile(filePath, 'Lorem Ipsum');
      app.addRecentDocument(filePath);
      callback.sendReply(filePath);
      return;
    }
    if (name === 'recent:clear') {
      app.clearRecentDocuments();
      callback.sendReply(true);
      return;
    }
  });
};
