import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
      <Section>
        <Paragraph>
          In Electron this fiddle constructs <Code>new window.Notification(title, &#123; body &#125;)</Code>
          directly in the renderer and updates the page from its <Code>onclick</Code>.
          Lynx replaces the Chromium renderer, so there is no DOM
          <Code> Notification</Code> here. Instead the UI awaits
          <Code> bridge.call('notification:showFromRenderer')</Code>, and main
          constructs the OS notification with
          <Code> new Notification(&#123; title, body &#125;).show()</Code> — the
          same main-process API Electron exposes.
        </Paragraph>
      </Section>
      <Section>
        <Paragraph>
          Note (partial): the renderer Web Notification API is not available in
          Lynx, so this bridges to the main-process <Code>Notification</Code>.
          When the OS surfaces a click, main pushes it back via
          <Code> win.sendGlobalEvent('notification-clicked')</Code> and the line
          above updates to <Code>{CLICK_MESSAGE}</Code>, matching upstream.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
