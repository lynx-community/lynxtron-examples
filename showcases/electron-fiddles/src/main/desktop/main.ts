import { app, LynxWindow } from '@lynx-js/lynxtron';
import path from 'path';
import { FIDDLES, type FiddleMeta } from '../../shared/manifest';
import { fiddleMains, type FiddleContext } from './registry';

// Identifiable instance name so this build is distinguishable in
// `lynx-devtool list-clients` (esp. alongside other parallel sessions).
app.setName('Electron Fiddles on Lynxtron');

const bundlePath = (id: string) => path.join(__dirname, `${id}.lynx.bundle`);

/** Open a fiddle in its own window and wire its main-process handlers. */
function openFiddle(id: string): void {
  const meta: FiddleMeta | undefined = FIDDLES.find((f) => f.id === id);
  if (!meta || meta.status === 'na' || !meta.dir) {
    console.error(`[fiddles] no launchable fiddle for id "${id}"`);
    return;
  }
  // Only pass through the chrome options a fiddle actually declares. Spelling
  // an unset option as an explicit `undefined` is NOT the same as omitting it —
  // LynxWindow reads the key as present and falls back to `false`, which turned
  // the default-chrome baseline into a non-resizable window.
  const chrome: Record<string, unknown> = {};
  for (const key of ['frame', 'transparent', 'titleBarStyle', 'resizable', 'alwaysOnTop', 'backgroundColor'] as const) {
    const value = meta.window?.[key];
    if (value !== undefined) chrome[key] = value;
  }

  const win = new LynxWindow({
    width: meta.window?.width ?? 720,
    height: meta.window?.height ?? 560,
    title: meta.title,
    ...chrome,
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  } as any);

  const ctx: FiddleContext = { win, openFiddle };
  try {
    fiddleMains[id]?.(win, ctx);
  } catch (err) {
    // Non-blocking: a failing fiddle must not freeze the launcher. Log and
    // still show the window so the UI renders (its buttons may just be inert).
    console.error(`[fiddles] main error in "${id}":`, err);
  }
  win.show();
  win.loadFile(bundlePath(id));
}

app.whenReady().then(() => {
  const home = new LynxWindow({
    width: 960,
    height: 720,
    title: 'Electron Fiddles on Lynxtron',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  home.on('-lynx-message', (name, data) => {
    if (name === 'launchFiddle') {
      const id = String((data as Record<string, unknown>)?.id ?? '');
      if (id) openFiddle(id);
    }
  });

  home.show();
  home.loadFile(bundlePath('main'));

  // Dev affordance: LYNXTRON_FIDDLE=<id[,id...]> opens those fiddles directly on
  // startup, useful for manual testing and screenshot verification.
  const directIds = process.env.LYNXTRON_FIDDLE;
  if (directIds) {
    for (const id of directIds.split(',').map((s) => s.trim()).filter(Boolean)) {
      openFiddle(id);
    }
  }
});
