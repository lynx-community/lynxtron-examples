import { clipboard, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron docs/fiddles system/clipboard/copy main:
// ipcMain.handle('clipboard:writeText') → clipboard.writeText(text).
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'clipboard:writeText') {
      const text = typeof data === 'string' ? data : String(data ?? '');
      clipboard.writeText(text);
      callback.sendReply(text);
    }
  });
};
