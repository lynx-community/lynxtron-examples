import { app, LynxWindow } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { LYNX_BUNDLE_PATH } from './vendorPaths';

app.whenReady().then(() => {
  const win = new LynxWindow({
    width: 1120,
    height: 780,
    minWidth: 960,
    minHeight: 720,
    title: 'Native Texture Canvas',
  });

  win.show();
  win.loadFile(LYNX_BUNDLE_PATH);
  nudgeFramedWindowViewport(win, { width: 1120, height: 780 });

});
