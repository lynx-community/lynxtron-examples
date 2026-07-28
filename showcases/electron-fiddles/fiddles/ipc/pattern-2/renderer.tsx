import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles ipc/pattern-2 (renderer ↔ main, two-way invoke).
export function App() {
  const [filePath, setFilePath] = useState('');

  const onOpen = useCallback(async () => {
    const result = await bridgeCall<string | null>('dialog:openFile');
    setFilePath(result ?? '(canceled)');
  }, []);

  return (
    <DemoPage title="IPC: Renderer ↔ Main" supports="Pattern 2 · request / response"
      apis={['dialog.showOpenDialog']}>
      <Section heading="Open a file">
        <ActionButton label="Open a File" onTap={onOpen} />
        {filePath ? <ResultText>File path: {filePath}</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
