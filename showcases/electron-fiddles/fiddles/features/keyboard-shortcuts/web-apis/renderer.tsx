import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';

// Port of electron docs/fiddles features/keyboard-shortcuts/web-apis.
//
// Upstream listens for a DOM `keyup` on `window` and shows `event.key` (the last
// key the user pressed). Lynx is not a DOM, but it does expose real keyboard
// events on desktop: `bindkeyup`/`bindkeydown` on a node, and the `global-`
// variants (`global-bindkeyup`) which fire regardless of which node has focus —
// the direct analogue of a window-level listener. The event carries `key`, the
// same field the upstream fiddle reads.
export function App() {
  const [lastKey, setLastKey] = useState('');
  const [lastDown, setLastDown] = useState('');
  const [count, setCount] = useState(0);

  const onKeyUp = useCallback((e: any) => {
    const key = String(e?.key ?? e?.detail?.key ?? '');
    if (!key) return;
    setLastKey(key);
    setCount((c) => c + 1);
  }, []);

  const onKeyDown = useCallback((e: any) => {
    const key = String(e?.key ?? e?.detail?.key ?? '');
    if (key) setLastDown(key);
  }, []);

  const reset = useCallback(() => {
    setLastKey('');
    setLastDown('');
    setCount(0);
  }, []);

  return (
    <view
      style={{ width: '100%', height: '100%' }}
      global-bindkeyup={onKeyUp}
      global-bindkeydown={onKeyDown}
    >
      <DemoPage title="Keyboard Shortcuts (in-app)" supports="Key events · Process: Renderer (Lynx)">
        <Section heading="Press any key in this window">
          <KV k="Last Key Pressed (keyup)" v={lastKey || '—'} />
          <KV k="Last Key Down" v={lastDown || '—'} />
          <KV k="Keys Captured" v={String(count)} />
          {lastKey ? <ResultText>You pressed: {lastKey}</ResultText> : null}
          <ActionButton label="Reset" onTap={reset} variant="secondary" />
        </Section>
    </DemoPage>
    </view>
  );
}

root.render(<App />);
