import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, KV, Paragraph, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FitState {
  work: Rect;
  bounds: Rect;
}

// Port of electron docs/fiddles screen/fit-screen. Upstream reads the primary
// display's work area size and opens a window that fills it. Lynxtron exposes
// the same `screen` API and live window bounds, so this reads the work area and
// this window's bounds, then resizes the window to fit the screen on tap. Main
// pushes 'fit-changed' on every native move / resize so the values stay live.
export function App() {
  const [state, setState] = useState<FitState | null>(null);

  useEffect(() => {
    bridgeCall<FitState>('fit:getState').then(setState).catch(() => {});
    const off = onGlobalEvent('fit-changed', (s: FitState) => setState(s));
    return off;
  }, []);

  const fit = useCallback(() => {
    bridgeSend('fit:toScreen');
  }, []);

  const work = state?.work;
  const bounds = state?.bounds;
  const fitted =
    work && bounds
      ? bounds.width === work.width && bounds.height === work.height
      : false;

  return (
    <DemoPage title="Fit Window to Screen" supports="screen.getPrimaryDisplay · setBounds">
      <Section heading="Primary display work area">
        {work ? (
          <>
            <KV k="width" v={String(work.width)} />
            <KV k="height" v={String(work.height)} />
            <KV k="origin" v={`${work.x}, ${work.y}`} />
            <ResultText>
              Available work area: {work.width}×{work.height}
            </ResultText>
          </>
        ) : (
          <Paragraph>Reading display info…</Paragraph>
        )}
      </Section>

      <Section heading="This window">
        {bounds ? (
          <>
            <KV k="width" v={String(bounds.width)} />
            <KV k="height" v={String(bounds.height)} />
            <KV k="position" v={`${bounds.x}, ${bounds.y}`} />
            <ResultText>
              {fitted
                ? 'Window fills the work area.'
                : `Current size: ${bounds.width}×${bounds.height}`}
            </ResultText>
          </>
        ) : (
          <Paragraph>Reading window bounds…</Paragraph>
        )}
      </Section>

      <Section heading="Fit to screen">
        <ActionButton label="Fit Window to Screen" onTap={fit} />
        <Paragraph>
          Resizes this window to fill the primary display's available work area
          (the screen minus the OS taskbar / dock).
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
