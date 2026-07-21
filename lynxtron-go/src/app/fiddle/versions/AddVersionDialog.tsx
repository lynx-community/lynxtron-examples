import { useState } from '@lynx-js/react';
import { Button, Callout, Dialog, FormGroup, InputGroup } from '../bp';

export interface AddVersionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, folderPath: string) => void;
}

export function AddVersionDialog(props: AddVersionDialogProps) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');

  const canAdd = name.trim().length > 0 && folder.trim().length > 0;

  return (
    <Dialog isOpen={props.isOpen} title="Add Local Lynxtron Version" onClose={props.onClose} width={520}>
      <FormGroup
        label="Version name"
        helperText="How this build is displayed in the version chooser."
      >
        <InputGroup
          fill
          placeholder="e.g. main (local)"
          value={name}
          onChange={setName}
        />
      </FormGroup>
      <FormGroup
        label="Path to Lynxtron folder"
        helperText="Absolute path to a folder containing the Lynxtron executable."
      >
        <InputGroup
          fill
          placeholder="/path/to/lynxtron.app"
          value={folder}
          onChange={setFolder}
        />
      </FormGroup>
      <Callout intent="primary" icon="info-sign">
        Local versions are stored in your Lynxtron Fiddle config and used only on this machine.
      </Callout>
      <view style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', columnGap: '8px', marginTop: '16px' } as any}>
        <Button text="Cancel" onClick={props.onClose} />
        <Button
          text="Add"
          intent="primary"
          disabled={!canAdd}
          onClick={() => { if (canAdd) { props.onAdd(name.trim(), folder.trim()); props.onClose(); } }}
        />
      </view>
    </Dialog>
  );
}
