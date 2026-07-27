import { clipboard, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles system/clipboard/paste main:
// ipcMain.handle('clipboard:readText')  → clipboard.readText()
// ipcMain.handle('clipboard:writeText') → clipboard.writeText(text)
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'clipboard:readText') {
      callback.sendReply(clipboard.readText());
    } else if (name === 'clipboard:writeText') {
      const text = typeof data === 'string' ? data : String(data ?? '');
      clipboard.writeText(text);
      callback.sendReply(text);
    }
  });
};
