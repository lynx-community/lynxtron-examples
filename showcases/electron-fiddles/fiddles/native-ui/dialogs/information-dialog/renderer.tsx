import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/information-dialog.
// The UI asks main to show a native message box; main replies with the index
// of the button the user picked, which we relay back into the UI.
export function App() {
  const [selection, setSelection] = useState('');

  const onShowDialog = useCallback(async () => {
    const index = await bridgeCall<number>('open-information-dialog');
    setSelection(`You selected: ${index === 0 ? 'yes' : 'no'} (index ${index})`);
  }, []);

  return (
    <DemoPage title="Information Dialog" supports="Dialogs · Process: Main">
      <Section>
        <ActionButton label="Show message box" onTap={onShowDialog} />
        {selection ? <ResultText>{selection}</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
