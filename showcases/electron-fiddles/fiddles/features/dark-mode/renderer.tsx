import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import './styles.css';

// Port of electron docs/fiddles features/dark-mode. Upstream toggles the OS
// theme via nativeTheme.themeSource ('light' | 'dark' | 'system') and lets the
// page's `prefers-color-scheme` CSS follow it. Lynxtron does not export
// nativeTheme, so we port the interaction as an in-app CSS theme toggle: the
// preview panel below recolors itself for the chosen source. Following the real
// system theme is not wired (see the note below).

type ThemeSource = 'system' | 'light' | 'dark';

export function App() {
  // 'system' resolves to a light preview here since we cannot read the OS theme.
  const [source, setSource] = useState<ThemeSource>('system');

  const toggle = useCallback(() => {
    // Mirror upstream's toggle: flip between light and dark.
    setSource((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const resetToSystem = useCallback(() => {
    setSource('system');
  }, []);

  const label = source === 'system' ? 'System' : source === 'dark' ? 'Dark' : 'Light';
  const isDark = source === 'dark';

  return (
    <DemoPage title="Dark Mode" supports="Features · in-app theme toggle">
      <Section heading="Theme source">
        <Row>
          <ActionButton label="Toggle Dark Mode" onTap={toggle} />
          <ActionButton label="Reset to System Theme" onTap={resetToSystem} variant="secondary" />
        </Row>
        <ResultText>Current theme source: {label}</ResultText>
      </Section>

      <Section heading="Preview">
        <view className={`dm-preview ${isDark ? 'dm-preview-dark' : 'dm-preview-light'}`}>
          <text className={`dm-preview-title ${isDark ? 'dm-text-dark' : 'dm-text-light'}`}>
            Hello World!
          </text>
          <text className={`dm-preview-body ${isDark ? 'dm-text-dark' : 'dm-text-light'}`}>
            This panel recolors with the selected theme.
          </text>
        </view>
      </Section>

      <Section>
        <Paragraph>
          Electron drives this with the <Code>nativeTheme</Code> module: the
          buttons set <Code>nativeTheme.themeSource</Code> to
          <Code> 'dark'</Code>, <Code>'light'</Code>, or <Code>'system'</Code>,
          and the page's <Code>prefers-color-scheme</Code> CSS follows along.
        </Paragraph>
        <Paragraph>
          Lynxtron does not export <Code>nativeTheme</Code>, so this port applies
          the theme in-app: the preview swaps its own colors instead of asking
          the OS. Because there is no <Code>nativeTheme</Code> bridge, the
          <Code> System</Code> option cannot follow your real OS theme — it just
          resets the in-app preview to its light default.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
