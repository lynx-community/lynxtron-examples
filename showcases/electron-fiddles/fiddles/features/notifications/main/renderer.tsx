import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/notifications/main — create and show a
// system Notification from the MAIN process. Upstream shows it automatically on
// launch; here a button asks main to create it so you can trigger it on demand.
export function App() {
  const [shown, setShown] = useState(false);

  const onShow = useCallback(async () => {
    await bridgeCall<boolean>('notification:show');
    setShown(true);
  }, []);

  return (
    <DemoPage title="Notification (from Main)" supports="Notifications · Process: Main">
      <Section heading="Basic Notification">
        <ActionButton label="Show Notification" onTap={onShow} />
        {shown ? (
          <ResultText>Notification created in the main process — check your system.</ResultText>
        ) : null}
      </Section>
      <Section>
        <Paragraph>
          Tapping the button awaits <Code>bridge.call('notification:show')</Code>.
          Main handles it in <Code>win.on('-lynx-invoke')</Code>, constructs
          <Code> new Notification(&#123; title, body &#125;)</Code> and calls
          <Code> .show()</Code> — the whole notification lives in the main process,
          exactly like Electron's <Code>Notification</Code> in <Code>main.js</Code>.
          Lynx replaces the Chromium renderer, but the Node/main-process API is the same.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
