import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, Field, ActionButton, ResultText, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/represented-file (macOS).
// Upstream calls win.setRepresentedFilename(path) + win.setDocumentEdited(true)
// to show a proxy icon + "edited" dot in the native title bar. Lynxtron does
// not export those APIs, so this partial uses the window TITLE — the standard
// cross-platform fallback ("filename — Edited") — via win.setTitle().
interface RepState {
  file: string;
  edited: boolean;
  title: string;
}

export function App() {
  const [file, setFile] = useState('~/Documents/report.md');
  const [state, setState] = useState<RepState | null>(null);

  const refresh = useCallback(async () => {
    setState(await bridgeCall<RepState>('repfile:get'));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setRepresented = useCallback(async () => {
    setState(await bridgeCall<RepState>('repfile:setFile', { file }));
  }, [file]);

  const toggleEdited = useCallback(async () => {
    setState(await bridgeCall<RepState>('repfile:toggleEdited'));
  }, []);

  return (
    <DemoPage title="Represented File" supports="macOS proxy icon → window title (partial)"
      apis={['win.setTitle']}>
      <Section heading="Associate a file with this window">
        <Row>
          <Field value={file} placeholder="/path/to/file" onInput={setFile} />
          <ActionButton label="Set represented file" onTap={setRepresented} />
        </Row>
        <Row>
          <ActionButton label="Toggle edited" onTap={toggleEdited} variant="secondary" />
        </Row>
        {state ? (
          <ResultText>Window title is now: “{state.title}” {state.edited ? '(edited)' : ''}</ResultText>
        ) : null}
      </Section>
    
      <Note>Lynxtron does not export setRepresentedFilename / setDocumentEdited (the native proxy-icon affordance). Ported via the window title (setTitle) — the cross-platform "filename — Edited" fallback.</Note></DemoPage>
  );
}

root.render(<App />);
