import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/open-file-or-directory.
// Opens a native dialog that accepts either a file or a directory, then shows
// the selected path(s).
export function App() {
  const [selection, setSelection] = useState('');

  const onSelect = useCallback(async () => {
    const filePaths = await bridgeCall<string[]>('dialog:openFileOrDirectory');
    setSelection(filePaths.length ? filePaths.join(', ') : '(nothing selected)');
  }, []);

  return (
    <DemoPage title="Open File or Directory" supports="dialog.showOpenDialog · Process: Main">
      <Section heading="Use system dialogs">
        <ActionButton label="Open file dialog" onTap={onSelect} />
        {selection ? <ResultText>You selected: {selection}</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
