import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, KV, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles
// features/window-customization/custom-title-bar/starter-code.
//
// Upstream is the deliberately plain "before" snippet of the custom-title-bar
// tutorial: `new BrowserWindow({})` with no options at all, loading a URL. Its
// whole point is the baseline — a window with the platform's *default* chrome —
// so the reader can see what each later fiddle in the series takes away
// (remove-title-bar, native-window-controls, custom-title-bar, custom-drag-region).
//
// The port keeps that role: this fiddle's main.ts opens this one with no window
// customization, so it renders the OS's default title bar. The one thing that
// does not carry over is `win.loadURL('https://example.com')` — LynxWindow loads
// Lynx bundles, not arbitrary web pages, so the window loads this fiddle's own
// bundle instead. The capability being demonstrated (default window chrome) is
// unaffected.
export function App() {
  const [info, setInfo] = useState<Record<string, string> | null>(null);

  const refresh = useCallback(async () => {
    const result = await bridgeCall<Record<string, string>>('window:describeChrome');
    setInfo(result);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DemoPage title="Starter Code (default chrome)" supports="Supports: Win, macOS, Linux · Process: Main">
      <Section heading="This window is unmodified">
        <Paragraph>
          This is the baseline of the window-customization series. The window was
          created with no chrome options — <Code>frame</Code>,{' '}
          <Code>titleBarStyle</Code> and <Code>transparent</Code> are all left at
          their defaults — so what you see around this content is the operating
          system's standard title bar and border.
        </Paragraph>
      </Section>

      <Section heading="Live window options">
        <Row>
          <ActionButton label="Read window chrome" onTap={refresh} />
        </Row>
        {info ? (
          Object.keys(info).map((k) => <KV key={k} k={k} v={String(info[k])} />)
        ) : (
          <ResultText>Loading…</ResultText>
        )}
      </Section>

      <Section heading="Compare with the rest of the series">
        <Paragraph>
          Open <Code>Remove Title Bar</Code>, <Code>Native Window Controls</Code>,{' '}
          <Code>Custom Title Bar</Code> and <Code>Custom Drag Region</Code> from the
          gallery next. Each starts from this window and removes or replaces one
          more piece of the native chrome.
        </Paragraph>
      </Section>

      <Section heading="Electron → Lynxtron">
        <Paragraph>
          Upstream is four lines: <Code>new BrowserWindow(&#123;&#125;)</Code>{' '}
          followed by <Code>win.loadURL('https://example.com')</Code>. Lynxtron's{' '}
          <Code>LynxWindow</Code> takes the same constructor options, so the
          default-chrome part is identical. Loading a remote web page is not
          portable — a LynxWindow renders Lynx bundles rather than HTML — so this
          window loads its own Lynx bundle instead.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
