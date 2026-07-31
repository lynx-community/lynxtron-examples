import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText, KV, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

interface DroppedFile {
  path: string;
  name: string;
  size: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Port of electron docs/fiddles features/drag-and-drop.
// Upstream lets you drag a generated markdown file OUT to Finder/Explorer via
// the HTML5 drag API. Lynx has no HTML5 drag-and-drop, so this ports the "files
// in" side: pick a file (stand-in for a drop), show its info, then reveal it in
// the OS file manager with shell.showItemInFolder.
export function App() {
  const [file, setFile] = useState<DroppedFile | null>(null);
  const [status, setStatus] = useState('');

  const onPick = useCallback(async () => {
    const result = await bridgeCall<DroppedFile | null>('dnd:pickFile');
    if (result) {
      setFile(result);
      setStatus('');
    } else {
      setStatus('(no file selected)');
    }
  }, []);

  const onReveal = useCallback(() => {
    if (!file) return;
    bridgeSend('dnd:reveal', { path: file.path });
    setStatus('Revealed in file manager');
  }, [file]);

  return (
    <DemoPage title="Drag & Drop (files in)" supports="dialog.showOpenDialog · shell.showItemInFolder · Process: Main"
      apis={['dialog.showOpenDialog', 'shell.showItemInFolder']}>
      <Section heading="Pick a file to inspect">
        <Row>
          <ActionButton label="Choose a File" onTap={onPick} />
          <ActionButton label="Reveal in File Manager" onTap={onReveal} variant="secondary" disabled={!file} />
        </Row>
        {file ? (
          <view>
            <KV k="Name" v={file.name} />
            <KV k="Size" v={formatBytes(file.size)} />
            <KV k="Path" v={file.path} />
          </view>
        ) : null}
        {status ? <ResultText>{status}</ResultText> : null}
      </Section>
    
      <Note>Electron uses the HTML5 drag-and-drop API. Lynx has no HTML5 DnD; ported as a file picker + shell.showItemInFolder as the nearest demo.</Note></DemoPage>
  );
}

root.render(<App />);
