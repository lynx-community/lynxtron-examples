import type { LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// remove-title-bar.
//
// Upstream is a one-liner: it opens a BrowserWindow with `titleBarStyle:
// 'hidden'` so the OS title bar is not drawn. In this showcase the launcher
// already creates the fiddle window with `{ titleBarStyle: 'hidden' }`, so main
// does NOT re-apply it. Instead we expose a small request/response surface so
// the UI can prove the window is fully functional without a native title bar:
// it reads the current bounds and lets the user re-title the window (the title
// is still tracked internally even though no native bar renders it).
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const bounds = () => {
    try {
      const b = win.getBounds();
      if (!b) return '(unavailable)';
      return `${b.width}×${b.height} @ (${b.x}, ${b.y})`;
    } catch {
      return '(unavailable)';
    }
  };

  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'window:getBounds') {
      callback.sendReply(bounds());
      return;
    }
    if (name === 'window:setTitle') {
      const title = String((data as { title?: unknown } | undefined)?.title ?? '');
      try {
        win.setTitle(title);
        callback.sendReply(true);
      } catch {
        callback.sendReply(false);
      }
    }
  });
};
