import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';
import './styles.css';

// Port of electron docs/fiddles features/online-detection.
//
// Upstream reads `navigator.onLine` in the renderer and updates on the window's
// `online` / `offline` events. Lynx has no `navigator`, so the main process
// probes connectivity (DNS lookup of a well-known host) on an interval and
// pushes each status to the UI via `win.sendGlobalEvent`. The UI subscribes,
// seeds the current value on mount, and renders a live connection indicator.

interface Status {
  online: boolean;
  at: number;
}

function time(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function App() {
  // null → still waiting for the first probe result.
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const off = onGlobalEvent('online-status', (data: Status) => {
      if (!data || typeof data.online !== 'boolean') return;
      setStatus(data);
      setChecking(false);
    });
    // Seed the current status so the indicator isn't blank on first render.
    bridgeCall<Status>('online:status')
      .then((s) => setStatus(s))
      .catch(() => {});
    return off;
  }, []);

  const onRecheck = useCallback(() => {
    setChecking(true);
    bridgeCall<Status>('online:recheck')
      .then((s) => {
        setStatus(s);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const state = status === null ? 'unknown' : status.online ? 'online' : 'offline';
  const label = status === null ? 'checking…' : status.online ? 'online' : 'offline';

  return (
    <DemoPage title="Online / Offline Detection" supports="Connectivity · probed in main → UI">
      <Section heading="Connection status">
        <view className="ond-indicator">
          <view className={`ond-dot ond-dot-${state}`} />
          <text className={`ond-status ond-status-${state}`}>{label}</text>
        </view>
        {status ? <ResultText>Last checked at {time(status.at)}</ResultText> : null}
        <Row>
          <ActionButton
            label={checking ? 'Checking…' : 'Re-check now'}
            onTap={onRecheck}
            disabled={checking}
          />
        </Row>
      </Section>
    
      <Note>Electron uses the renderer navigator.onLine. Lynx has no navigator; connectivity is probed from main and pushed to the UI.</Note></DemoPage>
  );
}

root.render(<App />);
