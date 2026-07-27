import { type LynxWindow, type Rectangle } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles windows/manage-windows/manage-window-state.
// Upstream opens a demo window and reports its move/resize bounds back to the
// renderer. Lynxtron exposes the window bounds API directly, so this drives the
// fiddle's OWN window: it replies with live bounds, applies bounds/deltas from
// the UI, and pushes 'bounds-changed' whenever the window is moved or resized.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const bounds = (): Rectangle => win.getBounds();

  const push = () => win.sendGlobalEvent('bounds-changed', bounds());

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'window:getBounds') {
      callback.sendReply(bounds());
    }
  });

  win.on('-lynx-message', (name, data) => {
    const d = (data ?? {}) as Partial<Rectangle>;
    if (name === 'window:setBounds') {
      win.setBounds({
        x: Math.round(d.x ?? bounds().x),
        y: Math.round(d.y ?? bounds().y),
        width: Math.round(d.width ?? bounds().width),
        height: Math.round(d.height ?? bounds().height),
      });
      push();
    } else if (name === 'window:nudge') {
      // Relative move/resize: dx/dy shift position, dw/dh grow/shrink size.
      const b = bounds();
      const nudge = (data ?? {}) as {
        dx?: number;
        dy?: number;
        dw?: number;
        dh?: number;
      };
      win.setBounds({
        x: b.x + Math.round(nudge.dx ?? 0),
        y: b.y + Math.round(nudge.dy ?? 0),
        width: Math.max(200, b.width + Math.round(nudge.dw ?? 0)),
        height: Math.max(150, b.height + Math.round(nudge.dh ?? 0)),
      });
      push();
    }
  });

  // Mirror upstream: report bounds live as the OS window is dragged / resized.
  win.on('move', push);
  win.on('resize', push);
};
