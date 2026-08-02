import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Field, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/external-links-file-manager.
// The `shell` module opens the OS file manager and the default web browser.
// Upstream used contextBridge + ipcRenderer.send; here we bridge into main
// (bridgeSend → lynxBridge.on) which calls shell.* on the main side.
export function App() {
  const [url, setUrl] = useState('https://lynxjs.org');
  const [status, setStatus] = useState('');

  const onOpenFileManager = useCallback(() => {
    bridgeSend('shell:showHome');
    setStatus('Revealed your home directory in the system file manager.');
  }, []);

  const onOpenExternal = useCallback(() => {
    const target = url.trim();
    if (!target) {
      setStatus('Enter a URL first.');
      return;
    }
    bridgeSend('shell:openExternal', { url: target });
    setStatus(`Opened ${target} in your default browser.`);
  }, [url]);

  return (
    <DemoPage
      title="External Links & File Manager"
      supports="shell module · Process: Main"
      apis={['app.getPath', 'shell.openExternal', 'shell.showItemInFolder']}
    >
      <Section heading="Open path in file manager">
        <Row>
          <ActionButton label="Reveal Home Folder" onTap={onOpenFileManager} />
        </Row>
        <Paragraph>
          Uses <Code>shell.showItemInFolder</Code> on the main process to open
          your system file manager at your home directory.
        </Paragraph>
      </Section>

      <Section heading="Open external links">
        <Field
          value={url}
          placeholder="https://lynxjs.org"
          onInput={setUrl}
        />
        <Row>
          <ActionButton label="Open in Browser" onTap={onOpenExternal} />
        </Row>
        <Paragraph>
          Rather than navigating inside the app, <Code>shell.openExternal</Code>
          {' '}hands the URL to your default web browser.
        </Paragraph>
      </Section>

      {status ? (
        <Section>
          <ResultText>{status}</ResultText>
        </Section>
      ) : null}
    </DemoPage>
  );
}

root.render(<App />);
