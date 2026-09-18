// Adapted from upstream browser-demo: isolate the Windows CEF profile.
import { app, LynxWindow, dialog } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
const cefWebview = require('@lynx-js/cef-webview/lynxtron');

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('org.lynxtron.examples.browser');
  cefWebview.initialize();

  const w = new LynxWindow({
    width: 1400,
    height: 1100,
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
  });

  let isFullScreen = false;

  // Handle bridge calls from Lynx UI
  // @ts-ignore
  w.on(
    '-lynx-invoke',
    (callback: { sendReply(value: unknown): void }, name: string, data: any) => {
      // In our architecture, UI calls NativeModules.bridge.request({ method, params })
      console.log(
        `[PC_Host] NativeModule Call: bridge.${name}`,
        data,
        callback,
        name
      );

      if (name === 'showDialog') {
        const { message } = data;
        dialog.showMessageBox({ message });
        callback.sendReply(null);
      } else if (name === 'getAppVersion') {
        callback.sendReply(app.getVersion());
      } else if (name === 'hideWindow') {
        w.minimize();
        callback.sendReply(null);
      } else if (name === 'fullScreenWindow') {
        isFullScreen = !isFullScreen;
        console.log('Toggling full screen to:', isFullScreen);
        w.setFullScreen(isFullScreen);
        callback.sendReply(null);
      } else if (name === 'closeWindow') {
        callback.sendReply(null);
        w.close();
      } else if (name === 'maximizeWindow') {
        // Read native state on every click: OS actions can change it too.
        // unmaximize restores native bounds/state; setSize only resizes and
        // cannot correctly undo maximize or restore the original position.
        if (w.isMaximized()) w.unmaximize();
        else w.maximize();
        callback.sendReply(null);
      }
    }
  );

  // set minimum size
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 400;

  w.on('resize', () => {
    if (typeof w.getSize === 'function') {
      const [width, height] = w.getSize();
      if (typeof width === 'number' && typeof height === 'number') {
        const targetW = Math.max(width, MIN_WIDTH);
        const targetH = Math.max(height, MIN_HEIGHT);
        if (
          (targetW !== width || targetH !== height) &&
          typeof w.setSize === 'function'
        ) {
          w.setSize(targetW, targetH);
        }
      }
    }
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
});
