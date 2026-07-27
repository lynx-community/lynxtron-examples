import { dialog, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron ipc/pattern-2 main: ipcMain.handle('dialog:openFile') → showOpenDialog.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dialog:openFile') {
      const { canceled, filePaths } = await dialog.showOpenDialog({});
      callback.sendReply(canceled ? null : filePaths[0]);
    }
  });
};
