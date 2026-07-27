import { dialog, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron native-ui/dialogs/information-dialog main:
// ipcMain.handle('open-information-dialog') → showMessageBox → return response index.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'open-information-dialog') {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Information',
        message: "This is an information dialog. Isn't it nice?",
        buttons: ['Yes', 'No'],
      });
      callback.sendReply(response);
    }
  });
};
