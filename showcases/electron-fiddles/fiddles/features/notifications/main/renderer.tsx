import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
    </DemoPage>
  );
}

root.render(<App />);
