import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, Field, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles ipc/pattern-1 (renderer → main, one-way).
export function App() {
  const [title, setTitle] = useState('Hello from Lynx');
  const [sent, setSent] = useState('');

  const onSet = useCallback(() => {
    bridgeSend('set-title', { title });
    setSent(title);
  }, [title]);

  return (
    <DemoPage title="IPC: Renderer → Main" supports="Pattern 1 · one-way message"
      apis={['win.setTitle']}>
      <Section heading="Set the window title">
        <Row>
          <Field value={title} placeholder="Window title" onInput={setTitle} />
          <ActionButton label="Set title" onTap={onSet} />
        </Row>
        {sent ? <ResultText>Sent “{sent}” to main → window title updated.</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
