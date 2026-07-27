import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
      <Section>
        {CHOICES.map((c) => (
          <Row key={c.id}>
            <ActionButton label={c.label} onTap={() => openWindow(c.id)} />
          </Row>
        ))}
        {lastOpened ? (
          <ResultText>Opened a new window: {lastOpened}</ResultText>
        ) : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
