import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/notifications/renderer.
// Upstream fires a Web `Notification` from the RENDERER on load and updates the
// page text on click. Lynx has no DOM Notification API, so the request is bridged
// to the main-process Notification instead; a button triggers it on demand.
const CLICK_MESSAGE = 'Notification clicked!';
const DEFAULT_OUTPUT = 'Click it to see the effect in this interface.';

export function App() {
  const [triggered, setTriggered] = useState(false);
  const [output, setOutput] = useState(DEFAULT_OUTPUT);

  useEffect(() => {
    // If the OS reports a notification click, mirror the upstream `onclick`.
    const off = onGlobalEvent('notification-clicked', (message: string) => {
      setOutput(message ?? CLICK_MESSAGE);
    });
    return off;
  }, []);

  const onShow = useCallback(async () => {
    setOutput(DEFAULT_OUTPUT);
    await bridgeCall<boolean>('notification:showFromRenderer');
    setTriggered(true);
  }, []);

  return (
    <DemoPage title="Notification (from Renderer)" supports="Notifications · Web API → Main (bridged)">
      <Section heading="Trigger a notification">
        <ActionButton label="Show Notification" onTap={onShow} />
        {triggered ? (
          <ResultText>Notification triggered — check your system tray.</ResultText>
        ) : null}
        <ResultText>{output}</ResultText>
      </Section>
    
      <Note>Electron uses the renderer Web Notification API; Lynx has no DOM Notification, so this bridges to the main-process Notification instead.</Note></DemoPage>
  );
}

root.render(<App />);
