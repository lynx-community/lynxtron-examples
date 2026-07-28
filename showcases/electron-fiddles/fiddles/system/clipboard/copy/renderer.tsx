import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, Field, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

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
    <DemoPage title="Clipboard: Copy" supports="Supports: Win, macOS, Linux · Process: Main"
      apis={['clipboard.writeText']}>
      <Section heading="Copy to clipboard">
        <Row>
          <Field value={text} placeholder="Type text to copy." onInput={setText} />
          <ActionButton label="Copy" onTap={onCopy} />
        </Row>
        {copied !== null ? (
          <ResultText>Copied! Paste anywhere (Cmd/Ctrl + V) to see: {copied}</ResultText>
        ) : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
