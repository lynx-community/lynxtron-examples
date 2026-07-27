import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Field, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';
import './styles.css';

interface PopupResult {
  shown: boolean;
  isEditable: boolean;
}

// Port of electron docs/fiddles menus/context-menu/web-contents.
// Right-click / long-press pops a native Menu (copy / cut / paste / select all),
// but only over an *editable* target — mirroring the upstream check on
// `params.isEditable`. Lynxtron has no `webContents.on('context-menu')`, so the
// long-press gesture (and a button fallback) drives `Menu.popup` in main.
export function App() {
  const [text, setText] = useState('Select some of this text, then long-press to copy it.');
  const [status, setStatus] = useState('');

  const popup = useCallback(async (isEditable: boolean) => {
    const res = await bridgeCall<PopupResult>('contextmenu:popup', { isEditable });
    if (res?.shown) {
      setStatus('Context menu shown (target is editable).');
    } else {
      setStatus('No menu — the target is not editable, so the popup is suppressed.');
    }
  }, []);

  return (
    <DemoPage title="Context Menu" supports="Menu.popup · long-press · Process: Main">
      <Section heading="Editable field">
        <Field value={text} onInput={setText} placeholder="Type here…" />
        <view
          className="ctx-area"
          bindlongpress={() => popup(true)}
          bindtap={() => popup(true)}
        >
          <text className="ctx-area-label">Editable area — long-press (or tap) to open the context menu.</text>
          <text className="ctx-area-hint">copy · cut · paste · select all</text>
        </view>
        <Row>
          <ActionButton label="Show Context Menu" onTap={() => popup(true)} />
        </Row>
      </Section>

      <Section heading="Non-editable area">
        <view
          className="ctx-area ctx-area-plain"
          bindlongpress={() => popup(false)}
          bindtap={() => popup(false)}
        >
          <text className="ctx-area-label">Read-only area — long-press here and nothing pops up.</text>
          <text className="ctx-area-hint">the editable-only gate suppresses the menu</text>
        </view>
        <Row>
          <ActionButton label="Try (Non-editable)" onTap={() => popup(false)} variant="secondary" />
        </Row>
      </Section>

      {status ? (
        <Section>
          <ResultText>{status}</ResultText>
        </Section>
      ) : null}
    </DemoPage>
  );
}

root.render(<App />);
