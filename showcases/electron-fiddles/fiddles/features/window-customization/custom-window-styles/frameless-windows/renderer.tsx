import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Paragraph, Code, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeSend, bridgeCall, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';
import './styles.css';

// Port of electron docs/fiddles
// features/window-customization/custom-window-styles/frameless-windows.
//
// Upstream is `new BrowserWindow({ frame: false })` loading a web page. A
// frameless window drops all OS chrome — including the minimize / maximize /
// close buttons — so the content has to supply its own in-content controls.
//
// This fiddle's own main.ts builds this window with `frame: false` (from the
// manifest), so the frame around this content is genuinely borderless. Below we
// render our own title-bar strip whose buttons drive the real window through the
// main process (window.minimize / maximize / close / center), and we show the
// live bounds + maximized state pushed from main so you can see the window react.

interface WindowState {
  bounds: string;
  maximized: boolean;
  platform: string;
}

export function App() {
  const [bounds, setBounds] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    const off = onGlobalEvent('window-state', (data: Partial<WindowState>) => {
      if (typeof data?.bounds === 'string') setBounds(data.bounds);
      if (typeof data?.maximized === 'boolean') setMaximized(data.maximized);
    });
    bridgeCall<WindowState>('window:state')
      .then((res) => {
        setBounds(res?.bounds ?? '');
        setMaximized(!!res?.maximized);
        setPlatform(res?.platform ?? 'unknown');
      })
      .catch(() => setPlatform('unknown'));
    return off;
  }, []);

  const minimize = useCallback(() => bridgeSend('window:minimize'), []);
  const toggleMax = useCallback(() => bridgeSend('window:maximize'), []);
  const center = useCallback(() => bridgeSend('window:center'), []);
  const close = useCallback(() => bridgeSend('window:close'), []);

  return (
    <view className="frameless-root">
      {/* Custom title bar — stands in for the OS chrome this frameless window
          lacks. Its buttons are real window controls wired through main. */}
      <view className="frameless-titlebar">
        <text className="frameless-titlebar-title">Frameless Window</text>
        <view className="frameless-controls">
          <view className="frameless-ctl" bindtap={minimize}>
            <text className="frameless-ctl-text">—</text>
          </view>
          <view className="frameless-ctl" bindtap={toggleMax}>
            <text className="frameless-ctl-text">{maximized ? '❐' : '☐'}</text>
          </view>
          <view className="frameless-ctl frameless-ctl-close" bindtap={close}>
            <text className="frameless-ctl-text">✕</text>
          </view>
        </view>
      </view>

      <DemoPage title="Frameless Window" supports="frame: false · in-content controls">
        <Section heading="This window right now">
          <KV k="Platform" v={platform} />
          <KV k="Maximized" v={maximized ? 'yes' : 'no'} />
          {bounds ? <KV k="Current bounds" v={bounds} /> : null}
          <ResultText>
            State updates live from main: {bounds || '(reading…)'}
          </ResultText>
        </Section>

        <Section heading="Re-center">
          <view className="frameless-action" bindtap={center}>
            <text className="frameless-action-text">Center window</text>
          </view>
          <Paragraph>
            A frameless window can be dragged only where the content says it can.
            Lynx's standardized CSS does not implement Chromium's{' '}
            <Code>app-region: drag</Code>, so instead of a CSS drag region this
            fiddle offers a <Code>Center window</Code> action that calls{' '}
            <Code>win.center()</Code> in main — a concrete example of moving the
            window from content.
          </Paragraph>
        </Section>
    </DemoPage>
    </view>
  );
}

root.render(<App />);
