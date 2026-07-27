import { dialog, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron docs/fiddles native-ui/dialogs/error-dialog main:
// ipcMain.on('open-error-dialog') → dialog.showErrorBox(...).
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-message', (name: string) => {
    if (name === 'open-error-dialog') {
      dialog.showErrorBox('An Error Message', 'Demonstrating an error message.');
    }
  });
};
