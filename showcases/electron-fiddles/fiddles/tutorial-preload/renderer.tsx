import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, KV, Paragraph } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { exposed } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles tutorial-preload — read values a preload script
// exposed via contextBridge (Lynxtron: exposeInLynxBTS → NativeModules.nodejs.exposed).
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
    <DemoPage title="Preload Script" supports="contextBridge · exposeInLynxBTS"
      apis={['contextBridge.exposeInLynxBTS']}>
      <Section heading="Values exposed from preload">
        {Object.keys(versions).length === 0 ? (
          <Paragraph>No exposed values found.</Paragraph>
        ) : (
          Object.entries(versions).map(([k, v]) => <KV k={k} v={String(v)} key={k} />)
        )}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
