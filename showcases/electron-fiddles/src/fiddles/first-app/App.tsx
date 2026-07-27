import { useState, useEffect } from '@lynx-js/react';
import { DemoPage, Section, KV, Paragraph, Code } from '../../shared/ui/Demo';
import { exposed } from '../../shared/bridge';
import './App.css';

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

      <Section>
        <Paragraph>
          In Electron the main process calls <Code>new BrowserWindow()</Code> and
          <Code> win.loadFile('index.html')</Code> to show a Chromium page. In
          Lynxtron the main process still owns the window, but the renderer is
          Lynx: this greeting is a ReactLynx component, not HTML. That is the only
          real difference in a first app — same Node main process, a Lynx view in
          place of a web page.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
