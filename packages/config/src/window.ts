/** Minimal shape of a LynxWindow, to avoid a hard dependency on the runtime
    types from this shared package. */
export interface ResizableWindow {
  getSize(): [number, number];
  setSize(width: number, height: number): void;
}

/**
 * Framed LynxWindows mis-size their LynxView at creation — the page renders
 * shorter than the window until ANY resize happens. Nudge once after load.
 * (Frameless windows are unaffected and must NOT call this.)
 *
 * This helper replaces seven per-showcase copies of the same setTimeout
 * block, which had already drifted (one used 800ms and pre-baked sizes).
 */
export function nudgeFramedWindowViewport(win: ResizableWindow, delayMs = 600): void {
  setTimeout(() => {
    try {
      const [w, h] = win.getSize();
      win.setSize(w + 1, h);
      win.setSize(w, h);
    } catch (_) {
      /* window already closed */
    }
  }, delayMs);
}
