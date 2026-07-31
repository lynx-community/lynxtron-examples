import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

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
    <DemoPage title="Clipboard: Paste" supports="Supports: Win, macOS, Linux · Process: Main"
      apis={['clipboard.readText', 'clipboard.writeText']}>
      <Section heading="Paste from clipboard">
        <Row>
          <ActionButton label="Paste" onTap={onPaste} />
          <ActionButton label="Read Clipboard" onTap={onReadOnly} variant="secondary" />
        </Row>
        {contents !== null ? (
          <ResultText>Clipboard contents: {contents === '' ? '(empty)' : contents}</ResultText>
        ) : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
