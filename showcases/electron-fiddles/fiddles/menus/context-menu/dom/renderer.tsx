import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Field, ActionButton, Paragraph, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles menus/context-menu/dom.
// Upstream right-clicks a specific <textarea> to open a native context menu
// (copy/cut/paste/selectall) for it. Lynx has no `contextmenu` event, so we
// long-press a specific element instead — `bindlongpress` fires a
// `context-menu` message and main pops the same native Menu at the window.
export function App() {
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);

  const openMenu = useCallback(() => {
    setCount((n) => n + 1);
    // Fire-and-forget, exactly like the upstream `ipcRenderer.send`.
    bridgeSend('context-menu');
  }, []);

  const openMenuViaButton = useCallback(async () => {
    setCount((n) => n + 1);
    // Same handler, awaited so the tap has a reachable path on any device.
    await bridgeCall<boolean>('context-menu');
  }, []);

  return (
    <DemoPage title="Context Menu (element-targeted)" supports="Menu.buildFromTemplate · Process: Main"
      apis={['Menu.buildFromTemplate']}>
      <Section heading="Long-press the target">
        <Paragraph>
          Long-press the box below (or edit the field first, then long-press) to
          open a native context menu — copy, cut, paste, select all — for this
          element.
        </Paragraph>
        <Field value={text} placeholder="Type here, then long-press the box…" onInput={setText} />
        <view
          className="ctx-target"
          bindlongpress={openMenu}
          style="margin-top:12px;padding:20px;border-radius:8px;background:#1f6feb22;border:1px dashed #1f6feb;align-items:center;justify-content:center;"
        >
          <text style="color:#1f6feb;font-weight:600;">Long-press me</text>
        </view>
        <view style="margin-top:12px;">
          <ActionButton label="Show context menu" onTap={openMenuViaButton} variant="secondary" />
        </view>
        {count > 0 ? <ResultText>Context menu requested {count}×</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
