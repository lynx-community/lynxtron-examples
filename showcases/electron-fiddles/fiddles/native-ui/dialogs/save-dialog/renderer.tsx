import { root, useCallback, useState } from '@lynx-js/react';
import { DemoPage, Section, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles native-ui/dialogs/save-dialog.
// A button asks main to open a native save dialog; the chosen path is shown.
export function App() {
  const [savedPath, setSavedPath] = useState('');

  const onSave = useCallback(async () => {
    const filePath = await bridgeCall<string | null>('save-dialog');
    setSavedPath(filePath ?? 'No path');
  }, []);

  return (
    <DemoPage title="Save Dialog" supports="dialog.showSaveDialog · Process: Main"
      apis={['dialog.showSaveDialog']}>
      <Section heading="Save an image">
        <ActionButton label="Open save dialog" onTap={onSave} />
        {savedPath ? <ResultText>Path selected: {savedPath}</ResultText> : null}
      </Section>
    </DemoPage>
  );
}

root.render(<App />);
