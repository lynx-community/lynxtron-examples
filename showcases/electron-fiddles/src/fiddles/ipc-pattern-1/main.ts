import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron ipc/pattern-1 main: ipcMain.on('set-title') → win.setTitle().
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'set-title') {
      const title = String((data as Record<string, unknown>)?.title ?? '');
      win.setTitle(title);
    }
  });
};
