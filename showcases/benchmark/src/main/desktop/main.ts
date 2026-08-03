import { app, LynxWindow, lynxBridge } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
import {
  getMemoryUsageDelta,
  getMemoryUsageSnapshot,
  type MemoryUsageDelta,
} from './memory-metrics';

const WINDOW_SETTLE_MS = 800;

let mainWindow: LynxWindow | null = null;
let secondWindow: LynxWindow | null = null;
let secondWindowDelta: MemoryUsageDelta | null = null;

function createBenchmarkWindow(title: string, width: number, height: number) {
  const w = new LynxWindow({
    width,
    height,
    title,
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  nudgeFramedWindowViewport(w, { width, height });
  return w;
}

function registerBridgeHandlers() {
  lynxBridge.handle('openSecondWindowAndMeasure', () => {
    if (secondWindow) {
      secondWindow.show();
      return { ok: true, delta: secondWindowDelta, alreadyOpen: true };
    }

    const before = getMemoryUsageSnapshot();
    secondWindow = createBenchmarkWindow('Benchmark Dashboard #2', 640, 460);
    secondWindow.on('closed', () => {
      secondWindow = null;
      secondWindowDelta = null;
    });
    secondWindow.show();
    secondWindow.loadFile(LYNX_BUNDLE_PATH);

    return new Promise((resolve) => {
      setTimeout(() => {
        const after = getMemoryUsageSnapshot();
        secondWindowDelta = getMemoryUsageDelta(before, after);
        resolve({ ok: true, delta: secondWindowDelta, alreadyOpen: false });
      }, WINDOW_SETTLE_MS);
    });
  });

  lynxBridge.handle('getSecondWindowDelta', () => ({
    isOpen: secondWindow != null,
    delta: secondWindowDelta,
  }));
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  mainWindow = createBenchmarkWindow('Benchmark Dashboard', 700, 520);
  mainWindow.show();
  mainWindow.loadFile(LYNX_BUNDLE_PATH);
});
