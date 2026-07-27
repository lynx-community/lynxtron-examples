import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/information-dialog.
// The UI asks main to show a native message box; main replies with the index
// of the button the user picked, which we relay back into the UI.
export function App() {
  const [selection, setSelection] = useState('');

  const onShowDialog = useCallback(async () => {
    const index = await bridgeCall<number>('open-information-dialog');
    setSelection(`You selected: ${index === 0 ? 'yes' : 'no'} (index ${index})`);
  }, []);

  return (
    <DemoPage title="Information Dialog" supports="Dialogs · Process: Main">
      <Section heading="Information Dialog">
        <ActionButton label="View Demo" onTap={onShowDialog} />
        {selection ? <ResultText>{selection}</ResultText> : null}
      </Section>
      <Section>
        <Paragraph>
          Tapping the button awaits <Code>bridge.call('open-information-dialog')</Code>.
          Main handles it in <Code>win.on('-lynx-invoke')</Code>, opens a native
          <Code> dialog.showMessageBox</Code> with the <Code>Yes</Code> / <Code>No</Code>
          buttons, and replies with the chosen button index via
          <Code> callback.sendReply()</Code> — Electron’s
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
        </Paragraph>
      </Section>
      <Section>
        <Paragraph>
          An information dialog can carry an icon, a title, a message, and your
          choice of buttons. Note: the <Code>title</Code> property is not shown on
          macOS. The Lynx UI never blocks — it simply awaits main’s reply.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
