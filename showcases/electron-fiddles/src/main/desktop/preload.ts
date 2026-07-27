import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome ?? 'n/a (Lynxtron has no Chromium)',
    electron: (process.versions as Record<string, string>).electron ?? 'n/a',
    lynxtron: (process.versions as Record<string, string>).lynxtron ?? 'unknown',
  },
});
