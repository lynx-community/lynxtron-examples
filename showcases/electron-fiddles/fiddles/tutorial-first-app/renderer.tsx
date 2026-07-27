import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, KV, Paragraph } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { exposed } from '@lynxtron-examples/fiddle-kit/bridge';
import './styles.css';

// Port of electron docs/fiddles tutorial-first-app — the "hello world" first app
// window. Electron loads an index.html greeting; Lynxtron renders this ReactLynx
// view instead of a Chromium page. We show the same greeting plus the runtime
// versions the preload exposes, echoing the tutorial's classic info line.
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
    <DemoPage title="First App" supports="Tutorial · your first window">
      <Section heading="Hello from Lynxtron!">
        <text className="first-app-wave">👋</text>
        <Paragraph>
          This window is a running Lynxtron app. The main process created it and
          told it to render this UI — the smallest complete app you can ship.
        </Paragraph>
      </Section>

      <Section heading="Running on">
        {Object.keys(versions).length === 0 ? (
          <Paragraph>No runtime versions were exposed.</Paragraph>
        ) : (
          Object.entries(versions).map(([k, v]) => <KV k={k} v={String(v)} key={k} />)
        )}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
