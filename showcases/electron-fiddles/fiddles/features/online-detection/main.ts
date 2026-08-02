import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

import { lookup } from 'node:dns';

// Port of electron docs/fiddles features/online-detection.
//
// Upstream reads `navigator.onLine` in the renderer and re-reads it on the
// window `online` / `offline` events. Lynx has no `navigator`, so connectivity
// is probed FROM THE MAIN PROCESS and pushed to the UI: main resolves a
// well-known hostname on an interval and forwards each status via
// `win.sendGlobalEvent('online-status')` — the "observe connectivity in main,
// react in the UI" adaptation of the original.

// Resolve a stable hostname; success ⇒ we have working network + DNS.
const PROBE_HOST = 'clients3.google.com';
const POLL_MS = 4000;

function probeOnline(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    // Guard against a hung lookup so a status update is never stuck.
    const timer = setTimeout(() => done(false), 3000);
    try {
      lookup(PROBE_HOST, (err) => {
        clearTimeout(timer);
        done(!err);
      });
    } catch {
      clearTimeout(timer);
      done(false);
    }
  });
}

let mainWindow: LynxWindow | null = null;
let lastOnline: boolean | null = null;
let interval: ReturnType<typeof setInterval> | undefined;

const push = (online: boolean) => {
  try {
    mainWindow?.sendGlobalEvent('online-status', { online, at: Date.now() });
  } catch {
    // Best-effort; a dropped event just means one missing UI update.
  }
};

const check = async () => {
  const online = await probeOnline();
  // Always push (the UI seeds "checking…" first); this also refreshes the
  // timestamp so the user can see the probe is live.
  lastOnline = online;
  push(online);
};

function startPolling() {
  check();
  interval = setInterval(check, POLL_MS);
}

function registerBridgeHandlers() {
  // Seed the UI on mount and support an on-demand recheck button.
  lynxBridge.handle('online:status', async () => {
    const online = lastOnline ?? (await probeOnline());
    lastOnline = online;
    return { online, at: Date.now() };
  });
  lynxBridge.handle('online:recheck', async () => {
    const online = await probeOnline();
    lastOnline = online;
    push(online);
    return { online, at: Date.now() };
  });
}

const setupWindow = (win: LynxWindow) => {
  // Stop the interval when this window goes away so we don't leak a timer.
  // `closed` may not be a confirmed event on every platform, so guard it.
  try {
    win.on('closed' as never, () => {
      if (interval) clearInterval(interval);
    });
  } catch {
    // No teardown hook available; the interval is harmless best-effort polling.
  }
};

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Online / Offline Detection",
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
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  setupWindow(win);
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
  startPolling();
});
