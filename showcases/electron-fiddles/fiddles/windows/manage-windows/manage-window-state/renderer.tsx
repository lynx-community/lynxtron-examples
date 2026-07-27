import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import {
  DemoPage,
  Section,
  Row,
  ActionButton,
  Field,
  KV,
  Paragraph,
  Code,
  ResultText,
} from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STEP = 40;

// Port of electron docs/fiddles windows/manage-windows/manage-window-state.
// Upstream opened a demo window and echoed its move/resize bounds. Lynxtron
// exposes the window bounds API, so this reads THIS window's live bounds and
// moves / resizes it from the UI. Main pushes 'bounds-changed' on every native
// move or resize (Electron's win.on('move'|'resize') + webContents.send).
export function App() {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [w, setW] = useState('');
  const [h, setH] = useState('');

  // Read once, then stay in sync with native move/resize pushes from main.
  useEffect(() => {
    bridgeCall<Bounds>('window:getBounds').then(setBounds).catch(() => {});
    const off = onGlobalEvent('bounds-changed', (b: Bounds) => setBounds(b));
    return off;
  }, []);

  const nudge = useCallback(
    (delta: { dx?: number; dy?: number; dw?: number; dh?: number }) => {
      bridgeSend('window:nudge', delta);
    },
    [],
  );

  const applyBounds = useCallback(() => {
    const next: Partial<Bounds> = {};
    if (x.trim() !== '') next.x = Number(x);
    if (y.trim() !== '') next.y = Number(y);
    if (w.trim() !== '') next.width = Number(w);
    if (h.trim() !== '') next.height = Number(h);
    bridgeSend('window:setBounds', next);
  }, [x, y, w, h]);

  return (
    <DemoPage title="Manage Window State" supports="BaseWindow · getBounds / setBounds">
      <Section heading="Live window bounds">
        {bounds ? (
          <>
            <KV k="x" v={String(bounds.x)} />
            <KV k="y" v={String(bounds.y)} />
            <KV k="width" v={String(bounds.width)} />
            <KV k="height" v={String(bounds.height)} />
            <ResultText>
              Size: {bounds.width}×{bounds.height} · Position: {bounds.x}, {bounds.y}
            </ResultText>
          </>
        ) : (
          <Paragraph>Reading window bounds…</Paragraph>
        )}
      </Section>

      <Section heading="Move the window">
        <Row>
          <ActionButton label="◀ Left" onTap={() => nudge({ dx: -STEP })} variant="secondary" />
          <ActionButton label="Right ▶" onTap={() => nudge({ dx: STEP })} variant="secondary" />
        </Row>
        <Row>
          <ActionButton label="▲ Up" onTap={() => nudge({ dy: -STEP })} variant="secondary" />
          <ActionButton label="Down ▼" onTap={() => nudge({ dy: STEP })} variant="secondary" />
        </Row>
      </Section>

      <Section heading="Resize the window">
        <Row>
          <ActionButton label="Wider +" onTap={() => nudge({ dw: STEP })} variant="secondary" />
          <ActionButton label="Narrower −" onTap={() => nudge({ dw: -STEP })} variant="secondary" />
        </Row>
        <Row>
          <ActionButton label="Taller +" onTap={() => nudge({ dh: STEP })} variant="secondary" />
          <ActionButton label="Shorter −" onTap={() => nudge({ dh: -STEP })} variant="secondary" />
        </Row>
      </Section>

      <Section heading="Set bounds explicitly">
        <Row>
          <Field value={x} placeholder="x" onInput={setX} />
          <Field value={y} placeholder="y" onInput={setY} />
        </Row>
        <Row>
          <Field value={w} placeholder="width" onInput={setW} />
          <Field value={h} placeholder="height" onInput={setH} />
        </Row>
        <ActionButton label="Apply Bounds" onTap={applyBounds} />
      </Section>

      <Section>
        <Paragraph>
          The UI reads bounds with <Code>bridge.call('window:getBounds')</Code> and
          drives the window with <Code>bridge.send('window:nudge' / 'window:setBounds')</Code>.
          Main applies them via <Code>win.setBounds()</Code> and pushes fresh bounds
          on every <Code>win.on('move')</Code> / <Code>win.on('resize')</Code> — so
          dragging or resizing the OS window updates the values above live. This
          mirrors Electron's <Code>getBounds</Code> / <Code>setBounds</Code> plus
          the move / resize events.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
