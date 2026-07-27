import { DemoPage, Section, Paragraph, Code } from '../../shared/ui/Demo';
import './App.css';

// Port of electron docs/fiddles features/window-customization/custom-title-bar.
//
// Upstream hides the native OS title bar (`titleBarStyle: 'hidden'`) and draws
// its own bar at the top of the page — a 30px blue strip with a centered white
// label. There is no IPC or main-process logic: the whole demo is a hidden
// native chrome plus a custom in-content title bar.
//
// Lynxtron keeps the same idea. The launcher already applies
// `titleBarStyle: 'hidden'` for this fiddle, so no native bar is drawn. We
// render our own `.titlebar` <view> as the first child, pinned to the top of
// the window, then the usual demo content scrolls beneath it.
export function App() {
  return (
    <view className="custom-title-bar-root">
      {/* Mount your title bar at the very top of the window. */}
      <view className="titlebar">
        <text className="titlebar-text">Cool titlebar</text>
      </view>

      <DemoPage title="Custom Title Bar" supports="titleBarStyle: hidden · in-content chrome">
        <Section heading="What you're seeing">
          <Paragraph>
            The blue strip above is not the operating system's title bar — the
            native one is hidden. It is an ordinary <Code>&lt;view&gt;</Code> drawn
            as the first element of the window, standing in as a custom title bar.
          </Paragraph>
        </Section>

        <Section>
          <Paragraph>
            In Electron this fiddle creates the window with{' '}
            <Code>titleBarStyle: 'hidden'</Code> to remove the default OS chrome,
            then mounts a <Code>.titlebar</Code> element at the top of the body.
            Lynxtron applies the same <Code>titleBarStyle: 'hidden'</Code> window
            option and replaces the Chromium renderer with Lynx, so the custom bar
            is a Lynx <Code>&lt;view&gt;</Code> here — full width, fixed height,
            with a centered label — rendered before the rest of the content.
          </Paragraph>
        </Section>
      </DemoPage>
    </view>
  );
}
