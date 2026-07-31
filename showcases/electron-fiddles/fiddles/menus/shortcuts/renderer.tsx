import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText, KV, Note } from '@lynxtron-examples/fiddle-kit/ui/Demo';
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
    <DemoPage title="Menu Shortcuts" supports="Menu.setApplicationMenu · accelerators · Process: Main"
      apis={['Menu.buildFromTemplate', 'Menu.setApplicationMenu', 'dialog.showMessageBox']}>
      <Section heading="Registered shortcut">
        <KV k="Accelerator" v={accelerator} />
        <ActionButton label="Trigger Shortcut Action" onTap={fire} />
        {pressed ? <ResultText>Fired — main showed the “Success!” dialog.</ResultText> : null}
      </Section>
    
      <Note>Electron uses globalShortcut, which Lynxtron does not export. Ported as application-menu accelerators via Menu.setApplicationMenu.</Note></DemoPage>
  );
}

root.render(<App />);
