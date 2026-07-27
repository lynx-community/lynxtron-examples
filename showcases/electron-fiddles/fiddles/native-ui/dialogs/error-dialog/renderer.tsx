import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
      <Section>
        <Paragraph>
          The UI sends <Code>bridge.send('open-error-dialog')</Code> — a
          fire-and-forget message. Main handles it in
          <Code> win.on('-lynx-message')</Code> and calls
          <Code> dialog.showErrorBox('An Error Message', 'Demonstrating an error message.')</Code>,
          which renders a native OS error dialog. This mirrors Electron's
          <Code> ipcRenderer.send</Code> / <Code>ipcMain.on</Code> pattern.
        </Paragraph>
      </Section>
      <Section>
        <Paragraph>
          Error boxes are handled in the main process because native utilities
          are more efficient there, and the call happens without interrupting
          the Lynx UI. You can even show an error box before the app is fully
          ready, which is useful for reporting startup failures.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
