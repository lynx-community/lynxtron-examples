import { app, LynxWindow } from '@lynx-js/lynxtron';
import path from 'path';

app.whenReady().then(() => {
  const window = new LynxWindow({
    width: 920,
    height: 720,
    minWidth: 760,
    minHeight: 600,
    title: 'BidirectionalList UI Lab',
    backgroundColor: '#f3f4f6',
  });
  window.show();
  window.loadFile(path.join(__dirname, 'main.lynx.bundle'));
});
