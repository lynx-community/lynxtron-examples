import './bp.css';

export interface CheckboxProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export function Checkbox(props: CheckboxProps) {
  const cls = 'bp3-checkbox' + (props.disabled ? ' bp3-disabled' : '');
  return (
    <view className={cls} bindtap={() => !props.disabled && props.onChange?.(!props.checked)}>
      <view className={'bp3-checkbox-indicator' + (props.checked ? ' bp3-checkbox-indicator--checked' : '')}>
        {props.checked ? <text className="bp3-checkbox-check">✓</text> : null}
      </view>
      <text className="bp3-checkbox-label">{props.label}</text>
    </view>
  );
}
