import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Field, Paragraph, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/recent-documents.
// Add / clear entries in the OS recent-documents list. In Lynxtron the UI
// asks main (via the bridge) to write a small file and register it with
// app.addRecentDocument, mirroring Electron's main-process API.
export function App() {
  const [fileName, setFileName] = useState('recently-used.md');
  const [added, setAdded] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const onAdd = useCallback(async () => {
    const name = fileName.trim() || 'recently-used.md';
    const filePath = await bridgeCall<string>('recent:add', { fileName: name });
    setAdded((prev) => [...prev, filePath]);
    setStatus(`Added to recent documents: ${filePath}`);
  }, [fileName]);

  const onClear = useCallback(async () => {
    await bridgeCall<boolean>('recent:clear');
    setAdded([]);
    setStatus('Cleared the recent-documents list.');
  }, []);

  return (
    <DemoPage title="Recent Documents" supports="Features · app.addRecentDocument"
      apis={['app.addRecentDocument', 'app.clearRecentDocuments', 'app.getPath']}>
      <Section heading="Add a recent document">
        <Field value={fileName} placeholder="file name" onInput={setFileName} />
        <Row>
          <ActionButton label="Add Recent Document" onTap={onAdd} />
          <ActionButton label="Clear List" onTap={onClear} variant="secondary" />
        </Row>
        {status ? <ResultText>{status}</ResultText> : null}
      </Section>

      <Section heading="Added this session">
        {added.length === 0 ? (
          <Paragraph>Nothing added yet. Tap “Add Recent Document”.</Paragraph>
        ) : (
          added.map((p, i) => <KV k={`#${i + 1}`} v={p} key={p} />)
        )}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
