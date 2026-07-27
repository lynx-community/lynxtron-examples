import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/notifications. Upstream used the
// HTML5 `window.Notification` API in the renderer. Lynx has no HTML5
// Notification API, so the UI asks main to show a native OS notification via
// Lynxtron's `Notification` class, then relays the shown title back into the UI.
export function App() {
  const [status, setStatus] = useState('');

  const showBasic = useCallback(async () => {
    const title = await bridgeCall<string>('show-notification', { kind: 'basic' });
    setStatus(`Shown: ${title}`);
  }, []);

  const showAdvanced = useCallback(async () => {
    const title = await bridgeCall<string>('show-notification', { kind: 'advanced' });
    setStatus(`Shown: ${title}`);
  }, []);

  return (
    <DemoPage title="Notifications" supports="Native UI · Process: Main">
      <Section heading="Basic notification">
        <ActionButton label="View Demo" onTap={showBasic} />
        <Paragraph>This demo shows a basic notification. Text only.</Paragraph>
      </Section>

      <Section heading="Notification with subtitle">
        <ActionButton label="View Demo" onTap={showAdvanced} variant="secondary" />
        <Paragraph>This demo shows a notification with an extra subtitle line.</Paragraph>
      </Section>

      {status ? <ResultText>{status}</ResultText> : null}

      <Section>
        <Paragraph>
          Tapping a button awaits <Code>bridge.call('show-notification')</Code>.
          Main handles it in <Code>win.on('-lynx-invoke')</Code>, builds a
          <Code> new Notification(&#123; title, body &#125;)</Code>, calls
          <Code> .show()</Code> to raise a real OS notification, and replies with
          the title via <Code>callback.sendReply()</Code>.
        </Paragraph>
      </Section>

      <Section>
        <Paragraph>
          Upstream Electron used the HTML5 <Code>window.Notification</Code> API
          directly in the renderer. Lynx has no HTML5 Notification API, so the
          notification is created in the main process instead. The upstream
          "image" variant attached a remote icon URL, which OS notifications do
          not reliably load; this port uses a native <Code>subtitle</Code> line
          in its place to keep the demo self-contained.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
