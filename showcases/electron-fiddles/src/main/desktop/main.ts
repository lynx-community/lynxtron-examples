import { app, LynxWindow } from '@lynx-js/lynxtron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { FIDDLES, type FiddleMeta } from '../../../catalog';

// The gallery. It owns no fiddle logic at all: every fiddle is a standalone
// Lynxtron project assembled under `.assembled/<id>/`, and launching one means
// spawning a *separate* Lynxtron process on it — the same relationship Electron
// Fiddle has with the fiddles it runs.
//
// That separation is the point. While all fiddles shared this process, the ones
// touching app-global state (Menu.setApplicationMenu, app.dock.setMenu,
// app.setAsDefaultProtocolClient) overwrote each other; now each gets its own
// application menu, dock menu and protocol registration, exactly like upstream.
app.setName('Electron Fiddles on Lynxtron');

/** Where `scripts/assemble.mjs` puts assembled projects (override for tests). */
function assembledRoot(): string {
  const override = process.env.LYNXTRON_FIDDLE_ASSEMBLED;
  if (override) return path.resolve(override);
  // dist/desktop/main.js -> showcase root
  return path.resolve(__dirname, '..', '..', '.assembled');
}

const children = new Set<ChildProcess>();

function launchFiddle(id: string): void {
  const meta: FiddleMeta | undefined = FIDDLES.find((f) => f.id === id);
  if (!meta || meta.status === 'na') {
    console.error(`[fiddles] "${id}" is not a launchable fiddle`);
    return;
  }

  const projectDist = path.join(assembledRoot(), id, 'dist', 'desktop');
  if (!fs.existsSync(path.join(projectDist, 'main.js'))) {
    // Fail loudly and actionably rather than spawning into a missing directory.
    console.error(
      `[fiddles] "${id}" has not been assembled yet (${projectDist} is missing).\n` +
        `[fiddles] Run: node scripts/assemble.mjs ${id} --build`,
    );
    return;
  }

  // `process.execPath` is the running Lynxtron binary, so this is exactly what
  // `lynxtron <project>` does from a shell — a brand new instance.
  const child = spawn(process.execPath, [projectDist], { stdio: 'inherit' });
  children.add(child);
  child.on('exit', () => children.delete(child));
  console.log(`[fiddles] launched ${id} (pid=${child.pid})`);
}

app.whenReady().then(() => {
  const home = new LynxWindow({
    width: 960,
    height: 720,
    title: 'Electron Fiddles on Lynxtron',
  });

  home.on('-lynx-message', (name, data) => {
    if (name === 'launchFiddle') {
      const id = String((data as Record<string, unknown>)?.id ?? '');
      if (id) launchFiddle(id);
    }
  });

  home.show();
  home.loadFile(path.join(__dirname, 'main.lynx.bundle'));

  // Dev affordance: LYNXTRON_FIDDLE=<id[,id...]> launches those directly.
  const direct = process.env.LYNXTRON_FIDDLE;
  if (direct) {
    for (const id of direct.split(',').map((s) => s.trim()).filter(Boolean)) launchFiddle(id);
  }
});

// A gallery that exits should not leave orphaned fiddle windows behind.
app.on('will-quit', () => {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
});
