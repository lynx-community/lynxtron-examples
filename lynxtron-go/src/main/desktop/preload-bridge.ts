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
    ...createFoundationBridge(dbg),
    ls: extensionHost.bridge,
    pty: pty.bridge,
    exampleArtifact: createExampleArtifactBridge(dbg),
    showcase: showcase.bridge,
  };
}
