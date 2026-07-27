import { useState, useEffect, useCallback } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, ResultText, KV } from '../../shared/ui/Demo';
import { bridgeCall, onGlobalEvent } from '../../shared/bridge';

// Port of electron docs/fiddles windows/manage-windows/window-events.
//
// Upstream opens a second demo window and listens for its focus / blur / close
// events to toggle a "Focus on Demo" button. Lynxtron listens for lifecycle
// events on this window itself (focus / blur / maximize / minimize / move /
// resize) in main and pushes each one to the UI. Here we render a live log of
// those events — the faithful "observe window events forwarded from main" core.

interface WindowEvent {
  type: string;
  detail: string;
  at: number;
}

const HINTS: Record<string, string> = {
  focus: 'Click back into this window',
  blur: 'Click another app / window',
  maximize: 'Maximize the window',
  unmaximize: 'Restore from maximized',
  minimize: 'Minimize the window',
  restore: 'Restore from minimized',
  move: 'Drag the window',
  resize: 'Drag an edge to resize',
};

function label(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function time(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function App() {
  const [events, setEvents] = useState<WindowEvent[]>([]);
  const [bounds, setBounds] = useState('');

  useEffect(() => {
    const off = onGlobalEvent('window-event', (data: WindowEvent) => {
      if (!data || !data.type) return;
      // Prepend newest; cap the log so it stays readable.
      setEvents((prev) => [data, ...prev].slice(0, 30));
    });
    // Seed the current bounds so the panel isn't empty on first render.
    bridgeCall<string>('window:getBounds')
      .then((b) => setBounds(b))
      .catch(() => setBounds('(unavailable)'));
    return off;
  }, []);

  const onClear = useCallback(() => setEvents([]), []);

  return (
    <DemoPage title="Window Events" supports="BrowserWindow lifecycle · main → UI">
      <Section heading="Try it">
        <Paragraph>
          Interact with this window to fire native events. Each is caught in the
          main process and pushed to the log below.
        </Paragraph>
        {Object.keys(HINTS).map((k) => (
          <KV k={label(k)} v={HINTS[k]} key={k} />
        ))}
      </Section>

      <Section heading="Event log">
        <Row>
          <ActionButton label="Clear log" onTap={onClear} variant="secondary" />
        </Row>
        {bounds ? <KV k="Current bounds" v={bounds} /> : null}
        {events.length === 0 ? (
          <Paragraph>No events yet — focus, move, resize, or minimize this window.</Paragraph>
        ) : (
          events.map((e, i) => (
            <ResultText key={`${e.at}-${i}`}>
              {time(e.at)} · {label(e.type)}
              {e.detail ? ` — ${e.detail}` : ''}
            </ResultText>
          ))
        )}
      </Section>

      <Section>
        <Paragraph>
          In Electron this fiddle opens a second <Code>BrowserWindow</Code> and
          subscribes to its <Code>focus</Code> / <Code>blur</Code> /{' '}
          <Code>close</Code> events, forwarding them to the renderer with{' '}
          <Code>webContents.send</Code>. Lynxtron replaces the Chromium renderer
          with Lynx, so main subscribes to this window's lifecycle events —{' '}
          <Code>win.on('focus' | 'blur' | 'maximize' | 'minimize' | 'move' | 'resize', …)</Code>{' '}
          — and pushes each via <Code>win.sendGlobalEvent('window-event')</Code>.
          The UI receives them through <Code>GlobalEventEmitter</Code> and appends
          to the live log — the same "observe window events in main, react in the
          UI" pattern the original demonstrates.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
