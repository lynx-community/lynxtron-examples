import { useState, useCallback } from '@lynx-js/react';
import { DemoPage, Section, Row, Field, ActionButton, Paragraph, Code, ResultText } from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

// Port of electron docs/fiddles system/clipboard/copy — write text to the system
// clipboard via clipboard.writeText, invoked through the Lynxtron bridge into main.
const DEMO_PHRASE = 'Lynxtron Demo!';

export function App() {
  const [text, setText] = useState(DEMO_PHRASE);
  const [copied, setCopied] = useState<string | null>(null);

  const onCopy = useCallback(async () => {
    const phrase = text === '' ? DEMO_PHRASE : text;
    const written = await bridgeCall<string>('clipboard:writeText', phrase);
    setCopied(written);
  }, [text]);

  return (
    <DemoPage title="Clipboard: Copy" supports="Supports: Win, macOS, Linux · Process: Main">
      <Section heading="Copy to clipboard">
        <Row>
          <Field value={text} placeholder="Type text to copy." onInput={setText} />
          <ActionButton label="Copy" onTap={onCopy} />
        </Row>
        {copied !== null ? (
          <ResultText>Copied! Paste anywhere (Cmd/Ctrl + V) to see: {copied}</ResultText>
        ) : null}
      </Section>
      <Section>
        <Paragraph>
          The UI awaits <Code>bridge.call('clipboard:writeText', text)</Code>. Main
          handles it in <Code>win.on('-lynx-invoke')</Code>, calls
          <Code> clipboard.writeText(text)</Code> to place the phrase on the system
          clipboard, and replies via <Code>callback.sendReply()</Code> — Electron's
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
          After copying, paste it into any other app to confirm.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
