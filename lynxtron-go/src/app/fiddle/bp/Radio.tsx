import './bp.css';

export interface RadioProps {
  checked: boolean;
  label: string;
  value?: string;
  disabled?: boolean;
  onChange?: () => void;
}

export function Radio(props: RadioProps) {
  const cls = 'bp3-radio' + (props.disabled ? ' bp3-disabled' : '');
  return (
    <view className={cls} bindtap={() => !props.disabled && props.onChange?.()}>
      <view className={'bp3-radio-indicator' + (props.checked ? ' bp3-radio-indicator--checked' : '')}>
        {props.checked ? <view className="bp3-radio-dot" /> : null}
      </view>
      <text className="bp3-radio-label">{props.label}</text>
    </view>
  );
}

export interface RadioGroupProps {
  value: string;
  label?: string;
  onChange: (value: string) => void;
  inline?: boolean;
  disabled?: boolean;
  className?: string;
  children?: any;
}

export function RadioGroup(props: RadioGroupProps) {
  const cls = [
    'bp3-radio-group',
    props.inline ? 'bp3-inline' : '',
    props.disabled ? 'bp3-disabled' : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  return (
    <view className={cls}>
      {props.label ? <text className="bp3-radio-group-label">{props.label}</text> : null}
      <view className={'bp3-radio-group-items' + (props.inline ? ' bp3-inline' : '')}>
        {props.children}
      </view>
    </view>
  );
}
