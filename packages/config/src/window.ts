/** Minimal shape of a LynxWindow, to avoid a hard dependency on the runtime
    types from this shared package. */
export interface ResizableWindow {
  getSize(): [number, number];
  setSize(width: number, height: number): void;
  getPosition?(): [number, number];
  setPosition?(x: number, y: number): void;
}

export interface NudgeFramedWindowViewportOptions {
  width?: number;
  height?: number;
  delayMs?: number;
}

/**
 * Framed LynxWindows mis-size their LynxView at creation — the page renders
 * shorter than the window until ANY resize happens. Nudge once after load.
 * (Frameless windows are unaffected and must NOT call this.)
 *
 * This helper replaces seven per-showcase copies of the same setTimeout
 * block, which had already drifted.
 */
export function nudgeFramedWindowViewport(
  win: ResizableWindow,
  options: NudgeFramedWindowViewportOptions | number = {},
): void {
  const platform = (globalThis as any).process?.platform;
  if (platform === 'win32') return;

  const normalized = typeof options === 'number' ? { delayMs: options } : options;
  const { width, height, delayMs = 600 } = normalized;
  setTimeout(() => {
    try {
      const [currentW, currentH] = win.getSize();
      const w = width ?? currentW;
      const h = height ?? currentH;
      const position = win.getPosition?.() ?? null;
      win.setSize(w + 1, h);
      win.setSize(w, h);
      if (position && win.setPosition) {
        win.setPosition(position[0], position[1]);
      }
    } catch (_) {
      /* window already closed */
    }
  }, delayMs);
}
