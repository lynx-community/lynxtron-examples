import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, KV, Paragraph, Code } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
    <DemoPage title="Preload Script" supports="contextBridge · exposeInLynxBTS">
      <Section heading="Values exposed from preload">
        {Object.keys(versions).length === 0 ? (
          <Paragraph>No exposed values found.</Paragraph>
        ) : (
          Object.entries(versions).map(([k, v]) => <KV k={k} v={String(v)} key={k} />)
        )}
      </Section>
      <Section>
        <Paragraph>
          The preload script calls <Code>contextBridge.exposeInLynxBTS(&#123; versions &#125;)</Code>.
          The UI reads them from <Code>NativeModules.nodejs.exposed</Code>. This
          mirrors Electron’s <Code>contextBridge.exposeInMainWorld</Code>.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
