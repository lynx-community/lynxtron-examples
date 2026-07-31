import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { exposed } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles quick-start ("Hello World!"). The original loads
// a window whose preload injects process.versions (node/chrome/electron) into the
// DOM. Lynxtron keeps the Node/main process but swaps the Chromium renderer for
// Lynx, so we read the same versions the shared preload exposed via
// contextBridge.exposeInLynxBTS and render them with the Lynx UI kit.
export function App() {
  const [versions, setVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setVersions(exposed<Record<string, string>>('versions') ?? {});
    } catch {
      setVersions({});
    }
  }, []);

  return (
    <DemoPage title="Hello World!" supports="Quick Start · runtime versions from preload"
      apis={['contextBridge.exposeInLynxBTS']}>
      <Section heading="We are using">
        <KV k="Node.js" v={versions.node ?? 'unknown'} />
        <KV k="Lynx" v="renderer (replaces Chromium)" />
        <KV k="Chromium" v={versions.chrome ?? 'n/a'} />
        <KV k="Electron" v={versions.electron ?? 'n/a'} />
        <KV k="Lynxtron" v={versions.lynxtron ?? 'unknown'} />
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
