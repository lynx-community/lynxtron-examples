import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';
import './styles.css';

// Port of electron docs/fiddles features/progress-bar.
// Drives the dock (macOS) / taskbar (Windows) progress indicator through
// win.setProgressBar. The auto-loop mirrors upstream (0 → 200% then reset);
// the manual buttons let you park the indicator at a fixed value. The on-screen
// bar tracks whatever value main last applied, pushed back over `progress:tick`.
export function App() {
  const [value, setValue] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const off = onGlobalEvent('progress:tick', (v: number) => setValue(Number(v)));
    return off;
  }, []);

  const start = useCallback(() => {
    bridgeSend('progress:start');
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    bridgeSend('progress:stop');
    setRunning(false);
  }, []);

  const set = useCallback((v: number) => {
    bridgeSend('progress:set', { value: v });
    setRunning(false);
  }, []);

  // Clamp the on-screen fill to 0–100%. Values >1 mean indeterminate on the
  // real indicator, so surface that instead of overflowing the bar.
  const clamped = Math.max(0, Math.min(1, value));
  const percent = Math.round(value * 100);
  const indeterminate = value > 1;
  const fillWidth = `${Math.round(clamped * 100)}%`;

  return (
    <DemoPage title="Progress Bar" supports="Supports: Win, macOS, Linux | Process: Main">
      <Section heading="Dock / taskbar progress">
        <view className="pb-track">
          <view className="pb-fill" style={{ width: fillWidth }} />
        </view>
        <ResultText>
          setProgressBar({value.toFixed(2)}) → {indeterminate ? 'indeterminate / pinned at 100%' : `${percent}%`}
        </ResultText>
      </Section>

      <Section heading="Auto loop (upstream behavior)">
        <Row>
          <ActionButton label={running ? 'Running…' : 'Start loop'} onTap={start} disabled={running} />
          <ActionButton label="Stop loop" onTap={stop} variant="secondary" disabled={!running} />
        </Row>
        <Paragraph>
          The loop ramps the fraction 0 → 200% in 3% steps every 100ms, then
          resets to just below 0 — exactly as Electron's fiddle drives it.
        </Paragraph>
      </Section>

      <Section heading="Set manually">
        <Row>
          <ActionButton label="0%" onTap={() => set(0)} variant="secondary" />
          <ActionButton label="25%" onTap={() => set(0.25)} variant="secondary" />
          <ActionButton label="50%" onTap={() => set(0.5)} variant="secondary" />
          <ActionButton label="75%" onTap={() => set(0.75)} variant="secondary" />
          <ActionButton label="100%" onTap={() => set(1)} variant="secondary" />
          <ActionButton label="Indeterminate" onTap={() => set(1.5)} variant="secondary" />
        </Row>
      </Section>

      <Section>
        <Paragraph>
          Keep an eye on the dock (macOS) or taskbar (Windows) while this runs.
          Main calls <Code>win.setProgressBar(fraction)</Code>: values between 0
          and 1 fill the indicator, and values above 1 show as indeterminate on
          Windows or pin at 100% elsewhere. The bar above tracks the same value,
          pushed back to Lynx via <Code>win.sendGlobalEvent('progress:tick')</Code>.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
