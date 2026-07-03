import { app, LynxWindow } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 800,
    height: 600,
    title: 'File Explorer',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
});
