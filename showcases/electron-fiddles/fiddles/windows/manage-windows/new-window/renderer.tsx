import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import {
  DemoPage,
  Section,
  Row,
  ActionButton,
  Paragraph,
  Code,
  ResultText,
} from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles windows/manage-windows/new-window.
//
// Upstream renders "Create a new window" with a "View Demo" button that sends a
// `new-window` IPC message; main opens a second BrowserWindow loading a URL.
// Lynxtron windows render Lynx bundles rather than arbitrary web pages, so the
// button asks main to open a *second top-level LynxWindow* via ctx.openFiddle —
// still main-process-owned window creation, the equivalent of new BrowserWindow.

// Each choice opens a different self-contained fiddle as the new window.
const CHOICES: { id: string; label: string }[] = [
  { id: 'first-app', label: 'Open "First App" window' },
  { id: 'app-information', label: 'Open "App Information" window' },
];

export function App() {
  const [lastOpened, setLastOpened] = useState('');

  useEffect(() => {
    return onGlobalEvent('window-opened', (data) => {
      setLastOpened(String((data as { id?: string })?.id ?? ''));
    });
  }, []);

  const openWindow = useCallback((id: string) => {
    bridgeSend('new-window', { id });
  }, []);

  return (
    <DemoPage title="Create a new window" supports="Supports: Win, macOS, Linux · Process: Main">
      <Section heading="View Demo">
        {CHOICES.map((c) => (
          <Row key={c.id}>
            <ActionButton label={c.label} onTap={() => openWindow(c.id)} />
          </Row>
        ))}
        {lastOpened ? (
          <ResultText>Opened a new window: {lastOpened}</ResultText>
        ) : null}
      </Section>

      <Section>
        <Paragraph>
          The <Code>LynxWindow</Code> module (Electron’s <Code>BrowserWindow</Code>)
          lets your app create new top-level windows. Tapping a button sends a
          <Code> bridge.send('new-window')</Code> message; main handles it in
          <Code> win.on('-lynx-message')</Code> and calls
          <Code> ctx.openFiddle(id)</Code>, which constructs a fresh
          <Code> new LynxWindow(...)</Code> and loads a Lynx bundle into it — just
          as Electron’s main process runs <Code>new BrowserWindow()</Code> and
          <Code> win.loadURL()</Code>.
        </Paragraph>
      </Section>

      <Section heading="ProTip">
        <Paragraph>
          Use a hidden window to run background tasks. Creating a window with
          <Code> show: false</Code> gives you an extra thread — a place to run
          work off the main window — without ever showing UI. In Electron this is
          <Code> new BrowserWindow(&#123; show: false &#125;)</Code>; Lynxtron windows take the
          same option.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
