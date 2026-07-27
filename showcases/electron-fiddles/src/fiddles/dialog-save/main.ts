import { dialog, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron save-dialog main: ipcMain.handle('save-dialog') → showSaveDialog.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'save-dialog') {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save an Image',
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }],
      });
      callback.sendReply(canceled ? null : (filePath ?? null));
    }
  });
};
