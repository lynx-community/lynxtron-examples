import { app, LynxWindow, dialog } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 400,
    height: 300,
    title: 'Counter Showcase',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  w.on('-lynx-invoke', async (callback, name, data) => {
    const params = asRecord(data);
    if (name === 'showDialog') {
      dialog.showMessageBox({ message: String(params.message ?? '') });
      callback.sendReply();
    } else if (name === 'getAppVersion') {
      callback.sendReply(app.getVersion());
    }
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
  nudgeFramedWindowViewport(w, { width: 400, height: 300 });

});
