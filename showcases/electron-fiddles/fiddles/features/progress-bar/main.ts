import { LynxWindow, app } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Port of electron docs/fiddles features/progress-bar.
// Upstream drives the dock/taskbar progress indicator on a setInterval loop:
// value ramps 0 → 2, then resets to a bit below 0, forever. Here the UI can
// start/stop that loop or set the fraction manually; main mirrors the current
// value to the UI via `progress:tick` so the on-screen bar tracks the real one.
const setupWindow = (win: LynxWindow) => {
  const INCREMENT = 0.03;
  const INTERVAL_DELAY = 100; // ms
  let progressInterval: ReturnType<typeof setInterval> | undefined;
  let c = 0;

  const apply = (value: number) => {
    // 0–1 shows progress; >1 is indeterminate (Windows) or pins at 100%.
    win.setProgressBar(value);
    win.sendGlobalEvent('progress:tick', value);
  };

  const stop = () => {
    if (progressInterval !== undefined) {
      clearInterval(progressInterval);
      progressInterval = undefined;
    }
  };

  const start = () => {
    if (progressInterval !== undefined) return;
    progressInterval = setInterval(() => {
      apply(c);
      if (c < 2) {
        c += INCREMENT;
      } else {
        c = -INCREMENT * 5; // reset to a bit less than 0 to show reset state
      }
    }, INTERVAL_DELAY);
  };

  win.on('-lynx-message', (name, data) => {
    if (name === 'progress:start') {
      start();
    } else if (name === 'progress:stop') {
      stop();
    } else if (name === 'progress:set') {
      stop();
      c = Number((data as Record<string, unknown>)?.value ?? 0);
      apply(c);
    }
  });
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Progress Bar",
};

/**
 * Create this fiddle's window. Exposed as a function rather than inlined
 * because several fiddles open additional windows of themselves (new-window,
 * dock menu), the same way upstream calls `new BrowserWindow()` again.
 */
function createWindow(): LynxWindow {
  const win = new LynxWindow({
    ...WINDOW_OPTIONS,
  } as any);
  setupWindow(win);
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  createWindow();
});
