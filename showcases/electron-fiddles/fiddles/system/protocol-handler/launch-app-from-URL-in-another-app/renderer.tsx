import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

const SCHEME = 'electron-fiddle';

// Port of electron docs/fiddles system/protocol-handler (launch-app-from-URL).
// Main registers the `electron-fiddle://` scheme as this app's default handler.
// Incoming deep links (Electron's app.on('open-url')) are pushed to the UI via
// win.sendGlobalEvent and listed below. A "simulate" button injects one so the
// demo is runnable without a packaged build / a second app to click a link from.
interface DeepLink {
  /** Stable render key: new links are PREPENDED, so array indices shift. */
  id: number;
  url: string;
}

let nextLinkId = 0;

export function App() {
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [links, setLinks] = useState<DeepLink[]>([]);

  useEffect(() => {
    // Ask main to register the protocol and report whether it succeeded.
    bridgeCall<boolean>('protocol:register')
      .then(setRegistered)
      .catch(() => setRegistered(false));

    // Receive deep links pushed from main.
    const off = onGlobalEvent('deep-link', (url: string) => {
      setLinks((prev) => [{ id: nextLinkId++, url: String(url) }, ...prev]);
    });
    return off;
  }, []);

  const onLaunchBrowser = useCallback(() => {
    // Electron opens the current page in the default browser so its link can
    // re-launch this app. In Lynxtron we open the docs page instead.
    bridgeSend('protocol:open-external', { url: 'https://www.electronjs.org/docs/latest/api/protocol' });
  }, []);

  const onSimulate = useCallback(() => {
    bridgeSend('protocol:simulate', { url: `${SCHEME}://open?from=demo` });
  }, []);

  const onClear = useCallback(() => setLinks([]), []);

  return (
    <DemoPage title="Protocol Handler (deep link)" supports="System · app.setAsDefaultProtocolClient"
      apis={['app.setAsDefaultProtocolClient', 'shell.openExternal']}>
      <Section heading="Custom URL scheme">
        <KV k="Scheme" v={`${SCHEME}://`} />
        <KV
          k="Registered"
          v={registered === null ? '…' : registered ? 'yes (default handler)' : 'no'}
        />
      </Section>

      <Section heading="Try it">
        <Row>
          <ActionButton label="Launch in Browser" onTap={onLaunchBrowser} />
          <ActionButton label="Simulate Deep Link" onTap={onSimulate} variant="secondary" />
        </Row>
        {links.length > 0 ? <ActionButton label="Clear" onTap={onClear} variant="secondary" /> : null}
      </Section>

      <Section heading="Incoming deep links">
        {links.length === 0 ? (
          <Paragraph>No deep links yet. Tap “Simulate Deep Link”, or open a real {SCHEME}:// link once packaged.</Paragraph>
        ) : (
          links.map((link) => <ResultText key={link.id}>You arrived from: {link.url}</ResultText>)
        )}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
