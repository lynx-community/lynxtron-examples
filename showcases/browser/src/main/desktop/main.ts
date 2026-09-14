import { app, LynxWindow, dialog } from '@lynx-js/lynxtron';
import type { LynxBridgeInvokeEvent } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
const cefWebview = require('@lynx-js/cef-webview/lynxtron');

app.whenReady().then(() => {
  cefWebview.initialize();

  const w = new LynxWindow({
    width: 1400,
    height: process.platform === 'win32' ? 800 : 1100,
    title: 'Lynxtron Browser',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
  });

  let isFullScreen = false;
  let isMaximized = false;
  let prevWidth = 0;
  let prevHeight = 0;

  // Handle bridge calls from Lynx UI
  // @ts-ignore
  w.on(
    '-lynx-invoke',
    async (callback: LynxBridgeInvokeEvent, name: string, data: any) => {
      // UI calls NativeModules.bridge.call(method, params, callback).
      console.log(
        `[PC_Host] NativeModule Call: bridge.${name}`,
        data,
        callback,
        name,
      );

      if (name === 'showDialog') {
        const { message } = data;
        dialog.showMessageBox({ message });
        callback.sendReply();
      } else if (name === 'getAppVersion') {
        callback.sendReply(app.getVersion());
      } else if (name === 'hideWindow') {
        w.minimize();
        callback.sendReply();
      } else if (name === 'fullScreenWindow') {
        isFullScreen = !isFullScreen;
        console.log('Toggling full screen to:', isFullScreen);
        w.setFullScreen(isFullScreen);
        callback.sendReply();
      } else if (name === 'closeWindow') {
        w.close();
        callback.sendReply();
      } else if (name === 'maximizeWindow') {
        if (process.platform === 'win32') {
          // Restore the native show state, as Lynxtron Go's frameless window does.
          if (w.isMaximized()) w.restore();
          else w.maximize();
          callback.sendReply();
          return;
        }
        if (!isMaximized) {
          const size = w.getSize();
          if (Array.isArray(size)) {
            prevWidth = typeof size[0] === 'number' ? size[0] : 0;
            prevHeight = typeof size[1] === 'number' ? size[1] : 0;
          } else if (size && typeof size === 'object') {
            prevWidth =
              typeof (size as any).width === 'number' ? (size as any).width : 0;
            prevHeight =
              typeof (size as any).height === 'number'
                ? (size as any).height
                : 0;
          }
          w.maximize();
          isMaximized = true;
        } else {
          if (prevWidth > 0 && prevHeight > 0) {
            w.setSize(prevWidth, prevHeight);
          }
          isMaximized = false;
        }
        callback.sendReply();
      }
    },
  );

  // set minimum size
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 400;

  w.on('resize', () => {
    if (typeof w.getSize === 'function') {
      const size = w.getSize();
      let width;
      let height;
      if (Array.isArray(size)) {
        width = size[0];
        height = size[1];
      }
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

app.on('window-all-closed', () => app.quit());
