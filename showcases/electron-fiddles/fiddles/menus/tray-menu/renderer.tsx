import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend, onGlobalEvent } from '@lynxtron-examples/fiddle-kit/bridge';

interface TrayState {
  isGreen: boolean;
  hasTitle: boolean;
}

// Port of electron docs/fiddles menus/tray-menu.
// Main owns a real Tray with a context Menu built from a template. This UI
// mirrors each menu item as a button and reflects the tray's live state
// (icon color + title), which main pushes back over `tray-state`.
export function App() {
  const [state, setState] = useState<TrayState>({ isGreen: false, hasTitle: false });

  useEffect(() => {
    // Reflect any change the native tray menu makes.
    const off = onGlobalEvent('tray-state', (s: TrayState) => setState(s));
    // Pull the current state on mount.
    bridgeCall<TrayState>('tray:state').then((s) => s && setState(s));
    return off;
  }, []);

  const popupMenu = useCallback(async () => {
    const s = await bridgeCall<TrayState>('tray:popup');
    if (s) setState(s);
  }, []);

  return (
    <DemoPage title="Tray Menu" supports="Tray · Menu.buildFromTemplate · Process: Main">
      <Section heading="Tray state">
        <KV k="Icon" v={state.isGreen ? 'Green' : 'Red'} />
        <KV k="Title" v={state.hasTitle ? '“Title”' : '(none)'} />
      </Section>

      <Section heading="Context menu">
        <Paragraph>
          Main built a real Tray with this context menu. Pop it up here, or drive
          each item directly with the buttons below.
        </Paragraph>
        <ActionButton label="Show Tray Menu" onTap={popupMenu} />
        <Row>
          <ActionButton label="Open App" onTap={() => bridgeSend('tray:openApp')} variant="secondary" />
          <ActionButton
            label={state.isGreen ? 'Set Red Icon' : 'Set Green Icon'}
            onTap={() => bridgeSend('tray:toggleIcon')}
            variant="secondary"
          />
          <ActionButton
            label={state.hasTitle ? 'Clear Title' : 'Set Title'}
            onTap={() => bridgeSend('tray:toggleTitle')}
            variant="secondary"
          />
        </Row>
      </Section>

      <Section>
        <Paragraph>
          Main keeps a Tray reference alive and builds its menu with
          <Code> Menu.buildFromTemplate</Code>. “Open App” focuses the window,
          the “Set Green Icon” checkbox swaps the tray image via
          <Code> tray.setImage</Code>, and “Set Title” toggles
          <Code> tray.setTitle</Code>. Each toggle is echoed to this UI over a
          <Code> tray-state</Code> global event — Electron’s
          <Code> Tray</Code> / <Code>Menu</Code> template pattern.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
