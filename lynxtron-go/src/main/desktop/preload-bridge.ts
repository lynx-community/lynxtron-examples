import { createExtensionHostService } from './preload-extension-host-service';
import { createFoundationBridge } from './preload-foundation-service';
import { createExampleArtifactBridge } from './preload-example-artifact-service';
import { createDebugLogger } from './preload-log';
import { createPtyService } from './preload-pty-service';
import { createShowcaseService } from './preload-showcase-service';

export function createPreloadBridge() {
  const dbg = createDebugLogger('Preload');
  const extensionHost = createExtensionHostService(dbg);
  const pty = createPtyService(dbg);
  const showcase = createShowcaseService(dbg);

  dbg('Preload starting, calling ensureExtHost...');
  extensionHost.start();

  process.on('exit', () => {
    extensionHost.dispose();
    pty.dispose();
    showcase.dispose();
  });

  return {
    // Dev-only automation surfaces (command files, window capture) are gated
    // on an explicit env opt-in — a shipped build must not poll /tmp for
    // commands any local process can write.
    devMode: process.env.LYNXTRON_FIDDLE_DEV === '1',
    // 'ide' when this instance was spawned as a dedicated IDE window
    // (Gallery IDE action) — the UI hides Fiddle-centric chrome like the
    // route-back chevrons in that mode.
    bootTarget: process.env.LYNXTRON_BOOT_TARGET ?? null,
    ...createFoundationBridge(dbg),
    ls: extensionHost.bridge,
    pty: pty.bridge,
    exampleArtifact: createExampleArtifactBridge(dbg),
    showcase: showcase.bridge,
  };
}
