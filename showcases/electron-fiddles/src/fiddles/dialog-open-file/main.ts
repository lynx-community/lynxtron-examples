import { dialog, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron docs/fiddles native-ui/dialogs/open-file-or-directory main:
// ipcMain.handle('open-file-dialog') → showOpenDialog({ properties: ['openFile','openDirectory'] }) → filePaths.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'dialog:openFileOrDirectory') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
      });
      callback.sendReply(canceled ? [] : filePaths);
    }
  });
};
