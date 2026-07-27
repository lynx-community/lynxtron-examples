import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/save-dialog.
// A button asks main to open a native save dialog; the chosen path is shown.
export function App() {
  const [savedPath, setSavedPath] = useState('');

  const onSave = useCallback(async () => {
    const filePath = await bridgeCall<string | null>('save-dialog');
    setSavedPath(filePath ?? 'No path');
  }, []);

  return (
    <DemoPage title="Save Dialog" supports="dialog.showSaveDialog · Process: Main">
      <Section heading="Save an image">
        <ActionButton label="View Demo" onTap={onSave} />
        {savedPath ? <ResultText>Path selected: {savedPath}</ResultText> : null}
      </Section>
      <Section>
        <Paragraph>
          The UI awaits <Code>bridge.call('save-dialog')</Code>. Main handles it in
          <Code> win.on('-lynx-invoke')</Code>, opens a native
          <Code> dialog.showSaveDialog</Code> (title "Save an Image", filtered to
          jpg/png/gif), and replies with the chosen path via
          <Code> callback.sendReply()</Code> — Electron's
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
        </Paragraph>
        <Paragraph>
          The dialog runs in the main process because native utilities are more
          efficient there, and the call happens without interrupting the Lynx UI.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
