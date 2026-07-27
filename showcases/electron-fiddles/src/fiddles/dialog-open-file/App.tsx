import { useState, useCallback } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

// Port of electron docs/fiddles native-ui/dialogs/open-file-or-directory.
// Opens a native dialog that accepts either a file or a directory, then shows
// the selected path(s).
export function App() {
  const [selection, setSelection] = useState('');

  const onSelect = useCallback(async () => {
    const filePaths = await bridgeCall<string[]>('dialog:openFileOrDirectory');
    setSelection(filePaths.length ? filePaths.join(', ') : '(nothing selected)');
  }, []);

  return (
    <DemoPage title="Open File or Directory" supports="dialog.showOpenDialog · Process: Main">
      <Section heading="Use system dialogs">
        <ActionButton label="View Demo" onTap={onSelect} />
        {selection ? <ResultText>You selected: {selection}</ResultText> : null}
      </Section>
      <Section>
        <Paragraph>
          Tapping the button awaits <Code>bridge.call('dialog:openFileOrDirectory')</Code>.
          Main handles it in <Code>win.on('-lynx-invoke')</Code>, opens a native
          <Code> dialog.showOpenDialog</Code> with <Code>properties: ['openFile', 'openDirectory']</Code>,
          and replies with the chosen path(s) via <Code>callback.sendReply()</Code> — Electron’s
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
        </Paragraph>
      </Section>
      <Section>
        <Paragraph>
          The dialog runs in the main process because native utilities are more
          efficient there, and it lets the call happen without interrupting the
          Lynx UI. The <Code>properties</Code> array is what lets a single dialog
          accept either a file or a folder.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
