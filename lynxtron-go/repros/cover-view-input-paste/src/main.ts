import { app, LynxWindow, Menu } from '@lynx-js/lynxtron';
import path from 'path';

app.whenReady().then(() => {
  const menuTemplate: any[] = [];
  if (process.platform === 'darwin') {
    // macOS reserves the first top-level item for the application menu.
    menuTemplate.push({ label: app.name, submenu: [{ role: 'quit' }] });
  }
  menuTemplate.push({
    label: 'Edit',
    submenu: [
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  const win = new LynxWindow({
    width: 680,
    height: 520,
    title: 'cover-view input paste repro',
    backgroundColor: '#111827',
  });
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
});
