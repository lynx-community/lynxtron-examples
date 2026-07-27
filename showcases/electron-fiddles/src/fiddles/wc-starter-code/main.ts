import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles
// features/window-customization/custom-title-bar/starter-code.
//
// Upstream has no main-process logic beyond `new BrowserWindow({})` — the
// launcher covers that by giving this fiddle no window options at all, so it
// gets the platform default chrome. This handler only reports the resulting
// window state back to the UI so the baseline is observable rather than
// asserted.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name !== 'window:describeChrome') return;
    const safe = <T,>(fn: () => T, fallback: T): T => {
      try {
        return fn();
      } catch {
        return fallback;
      }
    };
    const b = safe(() => win.getBounds(), undefined as any);
    callback.sendReply({
      platform: process.platform,
      frame: 'default (not overridden)',
      titleBarStyle: 'default (not overridden)',
      title: safe(() => win.getTitle(), '(unavailable)'),
      resizable: String(safe(() => win.isResizable(), '(unavailable)')),
      bounds: b ? `${b.width}×${b.height} @ (${b.x}, ${b.y})` : '(unavailable)',
    });
  });
};
