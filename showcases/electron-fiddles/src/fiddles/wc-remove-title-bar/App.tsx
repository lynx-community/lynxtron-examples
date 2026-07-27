import { useState, useEffect, useCallback } from '@lynx-js/react';
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
} from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// remove-title-bar. Upstream opens a window with `titleBarStyle: 'hidden'` so
// the OS title bar is not drawn. In this showcase the launcher already applies
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
    >
      <Section heading="This window has no native title bar">
        <Paragraph>
          The launcher created this window with <Code>titleBarStyle: 'hidden'</Code>,
          so the OS does not draw its title bar. The fiddle content extends to the
          very top edge of the window — there is no bar to grab or read the title
          from.
        </Paragraph>
      </Section>

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

      <Section>
        <Paragraph>
          Electron sets <Code>titleBarStyle: 'hidden'</Code> on the
          <Code> BrowserWindow</Code>; Lynxtron keeps the same window option and
          only swaps Chromium for the Lynx renderer, so the OS title bar is
          hidden identically. The UI reads bounds and re-titles the window over
          the Lynxtron bridge via <Code>bridge.call('window:getBounds')</Code> and
          <Code> bridge.call('window:setTitle')</Code>, handled in main with
          <Code> win.getBounds()</Code> / <Code>win.setTitle()</Code> — Electron's
          <Code> ipcRenderer.invoke</Code> / <Code>ipcMain.handle</Code> pattern.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
