import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles windows/manage-windows/frameless-window.
//
// Upstream renders "Create a frameless window" with a "View Demo" button that
// sends a `create-frameless-window` IPC message; main opens a second
// `new BrowserWindow({ frame: false })` loading a data: URL. Lynxtron windows
// render Lynx bundles rather than arbitrary web pages, so the button asks main
// to open a *second top-level LynxWindow* via ctx.openFiddle('window-frameless')
// — that fiddle is registered with `window: { frame: false }`, so this fiddle's main.ts
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
      <Section>
        <ActionButton label="Create frameless window" onTap={viewDemo} />
        {opened ? (
          <ResultText>Opened a new frameless window (frame: false).</ResultText>
        ) : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
