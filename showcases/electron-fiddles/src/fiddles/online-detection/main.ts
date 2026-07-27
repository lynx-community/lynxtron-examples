import { lookup } from 'node:dns';
import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

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

export const registerMain: RegisterMain = (win: LynxWindow) => {
  let last: boolean | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;

  const push = (online: boolean) => {
    try {
      win.sendGlobalEvent('online-status', { online, at: Date.now() });
    } catch {
      // Best-effort; a dropped event just means one missing UI update.
    }
  };

  const check = async () => {
    const online = await probeOnline();
    // Always push (the UI seeds "checking…" first); this also refreshes the
    // timestamp so the user can see the probe is live.
    last = online;
    push(online);
  };

  // Kick off polling. The UI can also request the current value on mount.
  const start = () => {
    check();
    interval = setInterval(check, POLL_MS);
  };
  start();

  // Stop the interval when this window goes away so we don't leak a timer.
  // `closed` may not be a confirmed event on every platform, so guard it.
  try {
    win.on('closed' as never, () => {
      if (interval) clearInterval(interval);
    });
  } catch {
    // No teardown hook available; the interval is harmless best-effort polling.
  }

  // Seed the UI on mount and support an on-demand recheck button.
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'online:status') {
      const online = last ?? (await probeOnline());
      last = online;
      callback.sendReply({ online, at: Date.now() });
    } else if (name === 'online:recheck') {
      const online = await probeOnline();
      last = online;
      push(online);
      callback.sendReply({ online, at: Date.now() });
    }
  });
};
