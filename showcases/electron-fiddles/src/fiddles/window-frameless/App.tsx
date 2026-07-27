import { useState, useEffect, useCallback } from '@lynx-js/react';
import {
  DemoPage,
  Section,
  ActionButton,
  Paragraph,
  Code,
  ResultText,
} from '../../shared/ui/Demo';
import { bridgeSend, onGlobalEvent } from '../../shared/bridge';

// Port of electron docs/fiddles windows/manage-windows/frameless-window.
//
// Upstream renders "Create a frameless window" with a "View Demo" button that
// sends a `create-frameless-window` IPC message; main opens a second
// `new BrowserWindow({ frame: false })` loading a data: URL. Lynxtron windows
// render Lynx bundles rather than arbitrary web pages, so the button asks main
// to open a *second top-level LynxWindow* via ctx.openFiddle('window-frameless')
// — that fiddle is registered with `window: { frame: false }`, so the launcher
// creates it as a genuinely frameless window (no title bar, no borders). This
// window you are reading is itself already frameless for the same reason.
export function App() {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    return onGlobalEvent('frameless-window-opened', () => {
      setOpened(true);
    });
  }, []);

  const viewDemo = useCallback(() => {
    bridgeSend('create-frameless-window');
  }, []);

  return (
    <DemoPage
      title="Create a frameless window"
      supports="Supports: Win, macOS, Linux · Process: Main"
    >
      <Section heading="View Demo">
        <ActionButton label="View Demo" onTap={viewDemo} />
        {opened ? (
          <ResultText>Opened a new frameless window (frame: false).</ResultText>
        ) : null}
      </Section>

      <Section>
        <Paragraph>
          A frameless window has no OS chrome — no title bar, tool bars, or
          borders. You make one by setting <Code>frame: false</Code> when
          creating the window. This very window is frameless for that reason.
          Tapping <Code>View Demo</Code> sends a
          <Code> bridge.send('create-frameless-window')</Code> message; main
          handles it in <Code>win.on('-lynx-message')</Code> and calls
          <Code> ctx.openFiddle('window-frameless')</Code>, which constructs a
          fresh <Code>new LynxWindow(&#123; frame: false &#125;)</Code> — just as
          Electron’s main process runs
          <Code> new BrowserWindow(&#123; frame: false &#125;)</Code>.
        </Paragraph>
      </Section>

      <Section heading="Transparent windows">
        <Paragraph>
          A frameless window can also be transparent. Setting
          <Code> transparent: true</Code> alongside
          <Code> frame: false</Code> lets the desktop show through — see the
          Transparent Window fiddle. For more, read the upstream Window
          Customization documentation.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}
