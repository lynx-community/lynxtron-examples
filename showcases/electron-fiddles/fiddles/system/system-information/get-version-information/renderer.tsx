import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, KV, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { exposed } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles system/get-version-information.
// Upstream reads `process.versions.electron` from a preload script and, on a
// "View Demo" tap, prints "This app is using Electron version: …".
// In Lynxtron the shared preload exposes `versions` (node / v8-ish / lynxtron)
// via contextBridge.exposeInLynxBTS, read here through NativeModules.nodejs.exposed.
export function App() {
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      setVersions(exposed<Record<string, string>>('versions') ?? {});
    } catch {
      setVersions({});
    }
  }, []);

  const onViewDemo = useCallback(() => {
    const runtime = versions.lynxtron ?? 'unknown';
    setMessage(`This app is using Lynxtron version: ${runtime}`);
  }, [versions]);

  const entries = Object.entries(versions);

  return (
    <DemoPage title="Get Version Information" supports="Supports: Win, macOS, Linux | Process: Both">
      <Section heading="View Demo">
        <ActionButton label="View Demo" onTap={onViewDemo} />
        {message ? <ResultText>{message}</ResultText> : null}
      </Section>

      <Section heading="process.versions (from preload)">
        {entries.length === 0 ? (
          <Paragraph>No version information found.</Paragraph>
        ) : (
          entries.map(([k, v]) => <KV k={k} v={String(v)} key={k} />)
        )}
      </Section>

      <Section>
        <Paragraph>
          The <Code>process</Code> module is built into Node.js, so it is available
          in both the main and app processes. The shared preload reads
          <Code> process.versions</Code> and exposes it via
          <Code> contextBridge.exposeInLynxBTS(&#123; versions &#125;)</Code>; the UI reads it
          from <Code>NativeModules.nodejs.exposed</Code>. This mirrors Electron’s
          preload + <Code>contextBridge.exposeInMainWorld</Code> pattern, but reports
          the Lynxtron runtime version instead of Electron/Chromium.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
