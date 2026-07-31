import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Paragraph, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles features/window-customization/custom-title-bar/
// native-window-controls.
//
// Upstream: a BrowserWindow with `titleBarStyle: 'hidden'` (no OS title bar)
// that KEEPS the native window controls — the macOS traffic-light buttons, or a
// `titleBarOverlay` with minimize / maximize / close on Windows & Linux. There
// is no renderer.js / index.html; the entire demo is the window chrome itself.
//
// In Lynxtron this fiddle's main.ts already builds this window with
// `{ titleBarStyle: 'hidden' }` (from the manifest), so the hidden title bar +
// native controls are live around this very content. This UI reads the platform
// and live bounds from main to explain what you're looking at and to prove the
// window still moves and resizes like any normal window.

interface ControlsInfo {
  platform: string;
  appName: string;
  bounds: string;
}

function controlsFor(platform: string): string {
  if (platform === 'darwin') return 'macOS traffic-light buttons (close · minimize · zoom)';
  if (platform === 'win32') return 'Windows title bar overlay (minimize · maximize · close)';
  if (platform === 'linux') return 'Linux title bar overlay (minimize · maximize · close)';
  return 'native window controls';
}

export function App() {
  const [info, setInfo] = useState<ControlsInfo | null>(null);
  const [bounds, setBounds] = useState('');

  useEffect(() => {
    const off = onGlobalEvent('window-bounds', (data: { bounds?: string }) => {
      if (data?.bounds) setBounds(data.bounds);
    });
    bridgeCall<ControlsInfo>('controls:info')
      .then((res) => {
        setInfo(res);
        setBounds(res?.bounds ?? '');
      })
      .catch(() => setInfo({ platform: 'unknown', appName: '', bounds: '' }));
    return off;
  }, []);

  const platform = info?.platform ?? 'unknown';

  return (
    <DemoPage title="Native Window Controls" supports="titleBarStyle: hidden · native controls kept"
      apis={['LynxWindow', 'app.getName', 'win.getBounds']}>
      <Section heading="This window right now">
        <Paragraph>
          This window was created with a hidden title bar, yet it still shows its
          native window controls. Look at the window frame around this content —
          there is no title bar strip, but the OS control buttons are still there.
        </Paragraph>
        <KV k="Platform" v={platform} />
        <KV k="Controls shown" v={controlsFor(platform)} />
        {bounds ? <KV k="Current bounds" v={bounds} /> : null}
      </Section>

      <Section heading="Try it">
        <Paragraph>
          Drag the window by its top edge and resize it from an edge or corner —
          it behaves like any normal window even without a visible title bar. Use
          the native control buttons to minimize, zoom / maximize, or close it.
        </Paragraph>
        <ResultText>
          Bounds update live as you move or resize: {bounds || '(reading…)'}
        </ResultText>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
