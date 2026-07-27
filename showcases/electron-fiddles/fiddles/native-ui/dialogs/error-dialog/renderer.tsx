import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/error-dialog.
// A tap fires a fire-and-forget message into main, which pops a native error box.
export function App() {
  const [count, setCount] = useState(0);

  const onShow = useCallback(() => {
    bridgeSend('open-error-dialog');
    setCount((c) => c + 1);
  }, []);

  return (
    <DemoPage title="Error Dialog" supports="dialog.showErrorBox · Process: Main">
      <Section heading="Show a native error box">
        <ActionButton label="View Demo" onTap={onShow} />
        {count > 0 ? (
          <ResultText>
            Sent open-error-dialog {count} {count === 1 ? 'time' : 'times'} — a native error box was shown.
          </ResultText>
        ) : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
