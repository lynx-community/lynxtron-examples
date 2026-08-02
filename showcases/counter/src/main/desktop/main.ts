import { app, LynxWindow, dialog, lynxBridge } from '@lynx-js/lynxtron';
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

  lynxBridge.handle('showDialog', (_event, data) => {
    const params = asRecord(data);
    dialog.showMessageBox({ message: String(params.message ?? '') });
  });

  lynxBridge.handle('getAppVersion', () => app.getVersion());

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
  nudgeFramedWindowViewport(w, { width: 400, height: 300 });

});
