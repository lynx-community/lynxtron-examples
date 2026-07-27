import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, ResultText, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import './styles.css';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// safe-area.
//
// Upstream hides the OS title bar (titleBarStyle: 'hidden') and, on Win/Linux,
// overlays the native window controls (titleBarOverlay: true). Its stylesheet
// then lays the custom `.titlebar` out around those controls using the browser
// env() insets:
//     margin-left: env(titlebar-area-x, 0);
//     width:       env(titlebar-area-width, 100%);
//     height:      env(titlebar-area-height, 30px);
// so the bar never sits underneath the OS buttons.
//
// GAP: Lynx does not expose titlebar-area env() variables, so we cannot read the
// real overlay geometry. We approximate the safe area with a FIXED inset on each
// side (this fiddle's main.ts applied titleBarStyle: 'hidden', so the OS controls do
// overlay this window's corners) and let you toggle it to see why the inset
// matters. The colored dots below are a stand-in illustration of where the OS
// window-control cluster would sit.

// Fixed stand-in for env(titlebar-area-*) — enough to clear a typical control
// cluster on either macOS (left) or Windows/Linux (right).
const SAFE_INSET = 78;

export function App() {
  const [safe, setSafe] = useState(true);
  const inset = safe ? SAFE_INSET : 0;

  const toggle = useCallback(() => setSafe((s) => !s), []);

  return (
    <DemoPage
      title="Title Bar Safe Area"
      supports="Supports: Win, macOS, Linux · Process: Renderer (CSS)"
    >
      <Section heading="Custom title bar">
        {/* The bar reserves `inset` px on both ends so its label never hides
            under the OS window controls that overlay the corners. */}
        <view
          className="titlebar"
          style={`padding-left:${inset}px;padding-right:${inset}px;`}
        >
          <view className="titlebar-controls">
            <view className="titlebar-dot dot-close" />
            <view className="titlebar-dot dot-min" />
            <view className="titlebar-dot dot-max" />
          </view>
          <view className="titlebar-label">
            <text className="titlebar-text">Cool titlebar</text>
          </view>
        </view>

        <Row>
          <ActionButton
            label={safe ? 'Disable safe-area inset' : 'Enable safe-area inset'}
            onTap={toggle}
          />
        </Row>
        <ResultText>
          Safe-area inset: {safe ? `${SAFE_INSET}px each side` : 'off (0px)'}
        </ResultText>
      </Section>
    
      <Note>Depends on titlebar-overlay env() safe-area insets; approximated with a fixed inset and noted in-app.</Note></DemoPage>
  );
}

root.render(<App />);
