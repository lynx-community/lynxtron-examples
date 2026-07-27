import { shell, app, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron native-ui/external-links-file-manager main:
//   ipcMain.on('open-home-dir')  → shell.showItemInFolder(os.homedir())
//   ipcMain.on('open-external')  → shell.openExternal(url)
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-message', (name, data) => {
    if (name === 'shell:showHome') {
      shell.showItemInFolder(app.getPath('home'));
    } else if (name === 'shell:openExternal') {
      const url = (data as { url?: string })?.url;
      if (url) shell.openExternal(url);
    }
  });
};
