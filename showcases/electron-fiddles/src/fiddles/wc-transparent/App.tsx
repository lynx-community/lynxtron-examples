import { Section, Paragraph, Code } from '../../shared/ui/Demo';
import './App.css';

// Port of electron docs/fiddles features/window-customization/custom-window-styles/
// transparent-windows.
//
// Upstream creates a tiny `new BrowserWindow({ frame: false, transparent: true })`
// and loads a page whose body has a fully transparent background. The only visible
// pixels are a white circle reading "Hello World!" — so the desktop shows through
// everywhere else, and the circle appears to float. The circle is also
// `app-region: drag`, so you can move the whole window by dragging it.
//
// Lynxtron keeps Electron's window model but swaps Chromium for Lynx. The launcher
// already creates this fiddle with `{ frame: false, transparent: true,
// backgroundColor: '#00000000' }`, so the window itself is frameless and its
// backing surface is transparent. All we render is the floating white circle plus
// a translucent explainer card — the root <view> has no opaque background, so the
// transparent window option is what you actually see.
export function App() {
  return (
    <view className="transparent-root">
      {/* The only fully-opaque pixels: a floating white circle, faithful to the
          upstream demo. Everything around it is the transparent window surface. */}
      <view className="floating-circle">
        <text className="circle-text">Hello World!</text>
      </view>

      {/* A translucent card so the explanation stays readable over whatever is
          showing through the transparent window. */}
      <view className="explainer-card">
        <text className="explainer-title">Transparent Window</text>
        <text className="explainer-supports">
          frame: false · transparent: true · Process: Main
        </text>

        <Section heading="What you're seeing">
          <Paragraph>
            This window has no OS chrome and a transparent backing surface, so the
            desktop shows through. The only solid pixels are the white circle
            above — it appears to float because everything around it is see-through.
          </Paragraph>
        </Section>

        <Section>
          <Paragraph>
            In Electron you get this by constructing{' '}
            <Code>new BrowserWindow(&#123; frame: false, transparent: true &#125;)</Code>{' '}
            and giving the page a fully transparent background. Lynxtron uses the
            same window model — the launcher applies{' '}
            <Code>&#123; frame: false, transparent: true, backgroundColor: '#00000000' &#125;</Code>{' '}
            for this fiddle — and swaps the Chromium renderer for Lynx. So the
            content here is a Lynx <Code>&lt;view&gt;</Code> with no opaque
            background instead of an HTML body, and the floating card is an ordinary
            Lynx element rather than a DOM node.
          </Paragraph>
        </Section>
      </view>
    </view>
  );
}
