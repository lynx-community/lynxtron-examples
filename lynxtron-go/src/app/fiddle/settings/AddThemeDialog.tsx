import { useState } from '@lynx-js/react';
import { Button, Callout, Dialog, FormGroup, InputGroup } from '../bp';

export interface AddThemeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, jsonPath: string) => void;
}

export function AddThemeDialog(props: AddThemeDialogProps) {
  const [name, setName] = useState('');
  const [jsonPath, setJsonPath] = useState('');

  const canAdd = name.trim().length > 0 && jsonPath.trim().length > 0;

  return (
    <Dialog isOpen={props.isOpen} title="Add Custom Theme" onClose={props.onClose} width={520}>
      <FormGroup label="Theme name">
        <InputGroup
          fill
          placeholder="e.g. Solarized Dark"
          value={name}
          onChange={setName}
        />
      </FormGroup>
      <FormGroup label="Path to theme JSON" helperText="A Fiddle-format theme file with token → color mappings.">
        <InputGroup
          fill
          placeholder="/path/to/theme.json"
          value={jsonPath}
          onChange={setJsonPath}
        />
      </FormGroup>
      <Callout intent="warning" icon="warning-sign">
        Custom theme import is scaffolded — theme JSON schema validation and preview will follow.
      </Callout>
      <view style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', columnGap: '8px', marginTop: '16px' } as any}>
        <Button text="Cancel" onClick={props.onClose} />
        <Button
          text="Add"
          intent="primary"
          disabled={!canAdd}
          onClick={() => { if (canAdd) { props.onAdd(name.trim(), jsonPath.trim()); props.onClose(); } }}
        />
      </view>
    </Dialog>
  );
}
