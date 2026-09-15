import { app, LynxWindow, lynxBridge } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
import { fetchReleaseSize } from './release-size';
import {
  getMemoryUsageDelta,
  getMemoryUsageSnapshot,
  type MemoryUsageDelta,
} from './memory-metrics';

const WINDOW_SETTLE_MS = 800;

// Main body starts after imports. Buffer in memory; print after loadFile returns.
const startupMarks: { stage: string; wallMs: number; monoMs: number }[] = [];
function markStartup(stage: string) {
  startupMarks.push({ stage, wallMs: Date.now(), monoMs: performance.now() });
}
markStartup('main-module-body');

// Use the OS process creation time, not the time this JS module or preload runs.
const processCreatedAt = (process as NodeJS.Process & {
  getCreationTime(): number | null;
}).getCreationTime();
let startupTime: number | null = null;

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
  let releaseSizeRequest: ReturnType<typeof fetchReleaseSize> | undefined;
  lynxBridge.handle('getReleaseSize', async () => {
    try {
      releaseSizeRequest ??= fetchReleaseSize();
      return { ok: true, ...(await releaseSizeRequest) };
    } catch (error) {
      releaseSizeRequest = undefined;
      return { ok: false, error: error instanceof Error ? error.message : 'Release size unavailable' };
    }
  });
  lynxBridge.handle('getStartupTime', () => startupTime);
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
  markStartup('app-ready');
  registerBridgeHandlers();
  markStartup('bridge-registered');
  markStartup('window-create-start');
  mainWindow = createBenchmarkWindow('Benchmark Dashboard', 700, 520);
  markStartup('window-create-end');
  markStartup('show-start');
  mainWindow.show();
  markStartup('show-end');
  markStartup('loadFile-start');
  // This benchmark defines Lynx FCP as OS process creation -> completion of the
  // initial main window's loadFile. LynxWindow.loadFile executes synchronously
  // on the main thread: capture its return, not an on-first-screen callback or
  // actual display presentation. Extra windows/reloads must not reset the metric.
  mainWindow.loadFile(LYNX_BUNDLE_PATH);
  const loadFileCompletedAt = Date.now();
  markStartup('loadFile-return');
  if (processCreatedAt != null && processCreatedAt > 0 && processCreatedAt <= loadFileCompletedAt) {
    startupTime = Math.round(loadFileCompletedAt - processCreatedAt);
    console.log(`[Benchmark] Process creation to synchronous loadFile completion: ${startupTime} ms`);
  }
  console.log('[BenchmarkStartup] ' + JSON.stringify({
    pid: process.pid, processCreatedAt, totalMs: startupTime,
    bundleEntrySinceProcessMs: processCreatedAt == null ? null :
      (globalThis as typeof globalThis & { __benchmarkBundleEntryAt: number }).__benchmarkBundleEntryAt - processCreatedAt,
    marks: startupMarks.map((mark, index) => ({
      stage: mark.stage,
      sinceProcessMs: processCreatedAt == null ? null : mark.wallMs - processCreatedAt,
      sincePreviousMs: index === 0 ? null : Number((mark.monoMs - startupMarks[index - 1].monoMs).toFixed(2)),
    })),
  }));
});
