import { useState, useEffect, useCallback } from '@lynx-js/react';
import { DemoPage, Section, Row, Field, ActionButton, Paragraph, Code, ResultText } from '../../shared/ui/Demo';
import { bridgeCall } from '../../shared/bridge';

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
    <DemoPage title="Represented File" supports="macOS proxy icon → window title (partial)">
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
      <Section>
        <Paragraph>
          On macOS, Electron calls <Code>win.setRepresentedFilename(path)</Code> and
          <Code> win.setDocumentEdited(true)</Code> to put a proxy icon and an
          “edited” dot in the native title bar (Cmd-click the title to reveal the
          file path).
        </Paragraph>
        <Paragraph>
          Note (partial): Lynxtron does not export those two APIs, so this port
          uses the window <Code>title</Code> instead — main calls
          <Code> win.setTitle(basename + (edited ? ' — Edited' : ''))</Code>, the
          same cross-platform fallback many editors use. The associated file and
          edited state are real; only the native proxy-icon affordance is absent.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
