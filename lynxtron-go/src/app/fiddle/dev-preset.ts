import { getExposed, foundationApi } from '../store';

/**
 * DEV_PRESET consumers must ALSO check this: the preset object ships in the
 * bundle, but its automation surfaces (command files, tour suppression) only
 * activate when the app was launched with LYNXTRON_FIDDLE_DEV=1.
 */
export function isDevMode(): boolean {
  try { return (getExposed() as any)?.devMode === true; } catch (_) { return false; }
}

// Development-only boot presets so iteration doesn't fight the first-run UX.
//
// - suppressTour: skip the welcome tour regardless of `fiddle.tour.seen`.
// - openSurface: programmatically open the dialog/surface currently being
//   developed right after boot (no clicking through the UI on every reload).
//
// Set DEV_PRESET = null before shipping/release builds.
export type DevSurface =
  | 'settings'
  | 'versions'
  | 'templates'
  | 'history'
  | 'tour'
  | null;

export interface DevCommand {
  name: string;
  data?: any;
  /** The full trimmed line, for echoing into the console. */
  raw: string;
}

/** Read-and-clear a dev command file and parse its `name {json-arg}` lines.
    Shared by the fiddle:* poller (Fiddle.tsx) and the app:* poller
    (App.tsx) — the two pollers are deliberately separate (the App one must
    outlive an unmounted Fiddle) but the file scaffolding is identical. */
export function drainCommandFile(cmdFile: string): DevCommand[] {
  const fs = (getExposed() as any)?.fs ?? (foundationApi() as any)?.fs;
  if (!fs?.readFile) return [];
  let raw = '';
  try { raw = fs.readFile(cmdFile) ?? ''; } catch (_) { return []; }
  if (!raw.trim()) return [];
  try { fs.writeFile?.(cmdFile, ''); } catch (_) {}
  const commands: DevCommand[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sp = trimmed.indexOf(' ');
    const name = sp === -1 ? trimmed : trimmed.slice(0, sp);
    let data: any;
    if (sp !== -1) { try { data = JSON.parse(trimmed.slice(sp + 1)); } catch (_) {} }
    commands.push({ name, data, raw: trimmed });
  }
  return commands;
}

export const DEV_PRESET: null | {
  suppressTour?: boolean;
  openSurface?: DevSurface;
  /**
   * Poll this file for `fiddle:*` commands (one per line, optional JSON arg
   * after a space) and dispatch them like app-menu events. Lets automation
   * drive the app from a shell without stealing mouse/keyboard focus:
   *   echo 'fiddle:run' > /tmp/fable5-cmd
   */
  commandFile?: string;
  /**
   * App-level command file (`app:*` lines: openGallery / galleryBack /
   * openShowcase {"name":...} / openShowcaseLegacy {"name":...} / routeBack /
   * routeForward). Lives in App so it keeps working while the Fiddle is
   * unmounted (gallery / legacy IDE pages).
   */
  appCommandFile?: string;
} = {
  suppressTour: true,
  openSurface: null,
  // NOTE: deliberately NO in-app periodic window capture: the native capture
  // spawns `screencapture` and blocks the MAIN THREAD in waitUntilExit
  // (~100-300ms per tick) — rhythmic frame drops while scrolling. Capture
  // externally instead (`screencapture -x -l <CGWindowID>`).
  commandFile: '/tmp/fable5-cmd',
  appCommandFile: '/tmp/fable5-app-cmd',
};
