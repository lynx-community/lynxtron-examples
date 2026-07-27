import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, Paragraph, Code, ResultText, KV } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles menus/shortcuts.
//
// Upstream binds CommandOrControl+Alt+K as a *global* shortcut that pops a
// "Success!" message box. Lynxtron has no globalShortcut, so main installs the
// same accelerator on an application-menu item (Menu.setApplicationMenu). This
// UI shows the bound accelerator and lets you fire the same action from a
// button, which main handles exactly like the menu item / accelerator would.
export function App() {
  const [accelerator, setAccelerator] = useState('CommandOrControl+Alt+K');
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    bridgeCall<string>('shortcut:accelerator').then((a) => a && setAccelerator(a));
  }, []);

  const fire = useCallback(async () => {
    await bridgeCall<number>('shortcut:fire');
    setPressed(true);
  }, []);

  return (
    <DemoPage title="Menu Shortcuts" supports="Menu.setApplicationMenu · accelerators · Process: Main">
      <Section heading="Registered shortcut">
        <KV k="Accelerator" v={accelerator} />
        <ActionButton label="Trigger Shortcut Action" onTap={fire} />
        {pressed ? <ResultText>Fired — main showed the “Success!” dialog.</ResultText> : null}
      </Section>

      <Section heading="What it does">
        <Paragraph>
          In Electron, keyboard shortcuts are called accelerators. They can be
          assigned to items in the application <Code>Menu</Code>, or registered
          globally so they fire even without keyboard focus. Main installs a
          menu carrying <Code>{accelerator}</Code>; pressing that combo — or
          tapping the button above — runs <Code>dialog.showMessageBox</Code> with
          the same “Success!” message.
        </Paragraph>
      </Section>

      <Section heading="Lynxtron note">
        <Paragraph>
          The original fiddle uses <Code>globalShortcut.register</Code>, which
          Lynxtron does not export. It is ported here as an application-menu
          accelerator via <Code>Menu.setApplicationMenu</Code> plus
          <Code> Menu.buildFromTemplate</Code>. The trade-off: the accelerator
          fires while the app has focus (menu scope) rather than system-wide.
          When registering accelerators, avoid overriding existing OS-level
          shortcuts.
        </Paragraph>
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
