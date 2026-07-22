import { app, LynxWindow } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import path from 'path';
import { LYNX_BUNDLE_PATH } from './vendorPaths';

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 1280,
    height: 860,
    title: 'PC Mouse Cursor Showcase',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
  nudgeFramedWindowViewport(w);

});
