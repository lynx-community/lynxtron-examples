import { root } from '@lynx-js/react';
import { DemoPage, Section, Paragraph, Code } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import './styles.css';

// Port of electron docs/fiddles
// features/window-customization/custom-title-bar/custom-drag-region.
//
// Upstream hides the native OS title bar (`titleBarStyle: 'hidden'`) and draws
// its own bar at the top of the body — a 30px blue strip with a centered white
// label. The one thing that makes this fiddle distinct from the plain custom
// title bar is CSS: the bar has `app-region: drag` (a.k.a
// `-webkit-app-region: drag`), which tells Chromium to treat that region as a
// window-move handle so the user can drag the frameless window around by the
// title bar.
//
// Lynxtron keeps Electron's main process but replaces the Chromium renderer
// with Lynx. Lynx has its own vendor-prefixed spelling of the same property:
// `-x-app-region: drag` (see the `system-context-menu` docs on BaseWindow —
// "draggable regions must be explicitly declared using the `-x-app-region: drag`
// CSS property"). So the fiddle ports 1:1: same hidden title bar, same
// in-content bar, drag handled by CSS rather than by main-process bookkeeping.
//
// status: working.
export function App() {
  return (
    <view
      className="custom-drag-region-root"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* Mount your title bar at the very top of the window. It carries
          `-x-app-region: drag`, making it a window-move handle. Try it: drag
          the blue strip and the whole window follows. */}
      <view className="titlebar">
        <text className="titlebar-text">Cool titlebar</text>
      </view>

      <DemoPage title="Custom Drag Region" supports="titleBarStyle: hidden · app-region: drag"
      apis={['LynxWindow']}>
        <Section heading="What you're seeing">
          <Paragraph>
            The blue strip above is not the operating system's title bar — the
            native one is hidden. It is an ordinary <Code>&lt;view&gt;</Code> drawn
            as the first element of the window, standing in as a custom title bar.
          </Paragraph>
        </Section>

        <Section heading="How it works in Electron">
          <Paragraph>
            Electron creates the window with <Code>titleBarStyle: 'hidden'</Code>{' '}
            to remove the default OS chrome, then mounts a{' '}
            <Code>.titlebar</Code> element and styles it with{' '}
            <Code>app-region: drag</Code>. Chromium reads that CSS and turns the
            region into a window-move handle, so dragging the bar moves the whole
            frameless window — even though the bar is just page content.
          </Paragraph>
        </Section>

        <Section heading="How it works on Lynxtron">
          <Paragraph>
            Lynxtron applies the same <Code>titleBarStyle: 'hidden'</Code> window
            option, and the custom bar above is a Lynx <Code>&lt;view&gt;</Code> —
            full width, fixed height, centered label. The drag affordance carries
            over too, under Lynx's vendor-prefixed spelling:{' '}
            <Code>-x-app-region: drag</Code> instead of Chromium's{' '}
            <Code>-webkit-app-region: drag</Code>. Nothing needs to round-trip
            through the main process.
          </Paragraph>
          <Paragraph>
            Note the usual caveat that also applies in Electron: anything
            interactive placed inside a drag region must opt back out
            with <Code>no-drag</Code>, or the window-move handler swallows its
            clicks. This bar is label-only, so it does not need to.
          </Paragraph>
        </Section>
      </DemoPage>
    </view>
  );
}

root.render(<App />);
