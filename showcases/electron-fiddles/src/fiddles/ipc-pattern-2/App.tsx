import { useState, useCallback } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText } from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

// Port of electron docs/fiddles ipc/pattern-2 (renderer ↔ main, two-way invoke).
export function App() {
  const [filePath, setFilePath] = useState('');

  const onOpen = useCallback(async () => {
    const result = await bridgeCall<string | null>('dialog:openFile');
    setFilePath(result ?? '(canceled)');
  }, []);

  return (
    <DemoPage title="IPC: Renderer ↔ Main" supports="Pattern 2 · request / response">
      <Section heading="Open a file">
        <ActionButton label="Open a File" onTap={onOpen} />
        {filePath ? <ResultText>File path: {filePath}</ResultText> : null}
      </Section>
      <Section>
        <Paragraph>
          The UI awaits <Code>bridge.call('dialog:openFile')</Code>. Main handles
          it in <Code>win.on('-lynx-invoke')</Code>, opens a native
          <Code> dialog.showOpenDialog</Code>, and replies with the path via
          <Code> callback.sendReply()</Code> — Electron’s
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
