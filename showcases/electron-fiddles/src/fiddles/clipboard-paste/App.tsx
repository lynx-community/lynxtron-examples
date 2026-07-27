import { useState, useCallback } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, ResultText } from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

// Port of electron docs/fiddles system/clipboard/paste — read text from the
// system clipboard via clipboard.readText, invoked through the Lynxtron bridge
// into main. The "Paste" button mirrors the upstream fiddle: it seeds the
// clipboard with a demo phrase, then reads it back and shows the contents.
const DEMO_PHRASE = 'What a demo!';

export function App() {
  const [contents, setContents] = useState<string | null>(null);

  const onPaste = useCallback(async () => {
    await bridgeCall<string>('clipboard:writeText', DEMO_PHRASE);
    const text = await bridgeCall<string>('clipboard:readText');
    setContents(text);
  }, []);

  const onReadOnly = useCallback(async () => {
    const text = await bridgeCall<string>('clipboard:readText');
    setContents(text);
  }, []);

  return (
    <DemoPage title="Clipboard: Paste" supports="Supports: Win, macOS, Linux · Process: Main">
      <Section heading="Paste from clipboard">
        <Row>
          <ActionButton label="Paste" onTap={onPaste} />
          <ActionButton label="Read Clipboard" onTap={onReadOnly} variant="secondary" />
        </Row>
        {contents !== null ? (
          <ResultText>Clipboard contents: {contents === '' ? '(empty)' : contents}</ResultText>
        ) : null}
      </Section>
      <Section>
        <Paragraph>
          Tap <Code>Paste</Code> to copy the phrase "{DEMO_PHRASE}" onto the system
          clipboard and immediately read it back — mirroring the upstream fiddle.
          The UI awaits <Code>bridge.call('clipboard:readText')</Code>; main handles
          it in <Code>win.on('-lynx-invoke')</Code>, calls
          <Code> clipboard.readText()</Code>, and replies via
          <Code> callback.sendReply()</Code> — Electron's
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
          Use <Code>Read Clipboard</Code> to read whatever you last copied from
          another app.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
