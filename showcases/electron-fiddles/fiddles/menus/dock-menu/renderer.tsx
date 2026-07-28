import { root, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, Row, ActionButton, Paragraph, Code, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall, bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';

interface DockState {
  dockAvailable: boolean;
  docsUrl: string;
}

// Port of electron docs/fiddles menus/dock-menu.
// Main builds a dock menu with `Menu.buildFromTemplate` and installs it via
// `app.dock.setMenu`. The dock is macOS-only, so on other platforms `app.dock`
// is undefined and the menu can't be installed. A dock menu is normally only
// reachable by right-clicking the dock icon, so this UI mirrors each item as a
// button that drives the exact same main-process action.
export function App() {
  const [state, setState] = useState<DockState>({ dockAvailable: false, docsUrl: '' });

  useEffect(() => {
    bridgeCall<DockState>('dock:state').then((s) => s && setState(s));
  }, []);

  return (
    <DemoPage title="Dock Menu (macOS)" supports="app.dock.setMenu · Menu.buildFromTemplate · Process: Main"
      apis={['Menu.buildFromTemplate', 'shell.openExternal']}>
      <Section heading="Dock status">
        <KV k="Platform dock" v={state.dockAvailable ? 'Available (macOS)' : 'Unavailable'} />
      </Section>

      {!state.dockAvailable ? (
        <Section>
          <Paragraph>
            The dock is macOS-only, so <Code>app.dock</Code> is undefined on this
            platform and the menu was not installed. The buttons below still run
            the same actions that each dock-menu item would trigger.
          </Paragraph>
        </Section>
      ) : null}

      <Section heading="Dock menu items">
        <Paragraph>
          Right-click the app's dock icon to see the custom menu. Or drive each
          item directly here:
        </Paragraph>
        <Row>
          <ActionButton label="New Window" onTap={() => bridgeSend('dock:newWindow')} />
          <ActionButton
            label="Close All Windows"
            onTap={() => bridgeSend('dock:closeAll')}
            variant="secondary"
          />
          <ActionButton
            label="Open Lynx Docs"
            onTap={() => bridgeSend('dock:openDocs')}
            variant="secondary"
          />
        </Row>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
