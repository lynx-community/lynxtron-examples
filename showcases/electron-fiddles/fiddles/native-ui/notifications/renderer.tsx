import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
    <DemoPage title="Notifications" supports="Native UI · Process: Main"
      apis={['Notification']}>
      <Section heading="Basic notification">
        <ActionButton label="Show notification" onTap={showBasic} />
        <Paragraph>This demo shows a basic notification. Text only.</Paragraph>
      </Section>

      <Section heading="Notification with subtitle">
        <ActionButton label="Show with subtitle" onTap={showAdvanced} variant="secondary" />
        <Paragraph>This demo shows a notification with an extra subtitle line.</Paragraph>
      </Section>

      {status ? <ResultText>{status}</ResultText> : null}
    </DemoPage>
  );
}

root.render(<App />);
