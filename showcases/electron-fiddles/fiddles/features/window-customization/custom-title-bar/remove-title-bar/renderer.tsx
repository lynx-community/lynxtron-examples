import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Field, KV, Paragraph, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// remove-title-bar. Upstream opens a window with `titleBarStyle: 'hidden'` so
// the OS title bar is not drawn. In this showcase this fiddle's main.ts applies
// that window option, so the window hosting this fiddle has NO native title
// bar — its content runs to the top edge of the window.
//
// This UI demonstrates the effect: it confirms the window is fully functional
// without a native title bar by reading its live bounds from main and letting
// you re-title the window (the title is still tracked internally even though no
// native bar renders it).
export function App() {
  const [bounds, setBounds] = useState('');
  const [title, setTitle] = useState('Lynxtron Fiddle');
  const [status, setStatus] = useState('');

  const refreshBounds = useCallback(async () => {
    const result = await bridgeCall<string>('window:getBounds');
    setBounds(result);
  }, []);

  const applyTitle = useCallback(async () => {
    const ok = await bridgeCall<boolean>('window:setTitle', { title });
    setStatus(ok ? `Window title set to “${title}”.` : 'Could not set title.');
  }, [title]);

  useEffect(() => {
    refreshBounds();
  }, [refreshBounds]);

  return (
    <DemoPage
      title="Remove Title Bar"
      supports="Supports: Win, macOS, Linux · Process: Main"
      apis={['LynxWindow', 'win.getBounds', 'win.setTitle']}
    >
      <Section heading="The window still works">
        <Row>
          <ActionButton label="Read window bounds" onTap={refreshBounds} />
        </Row>
        {bounds ? <KV k="bounds" v={bounds} /> : <ResultText>Loading…</ResultText>}
        <Paragraph>
          Hiding the title bar only removes the OS chrome — the window keeps its
          size, position and (internal) title. Set a new title below; it is
          tracked even though no native bar shows it.
        </Paragraph>
        <Field value={title} placeholder="Window title" onInput={setTitle} />
        <Row>
          <ActionButton label="Set window title" onTap={applyTitle} />
        </Row>
        {status ? <ResultText>{status}</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
