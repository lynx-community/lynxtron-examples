import { Icon, type IconName } from './Icon';
import './bp.css';

export interface InputGroupProps {
  value?: string;
  placeholder?: string;
  leftIcon?: IconName;
  rightElement?: any;
  fill?: boolean;
  large?: boolean;
  /** Dims the group and drops input/submit events (like Button's disabled). */
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function InputGroup(props: InputGroupProps) {
  const cls = [
    'bp3-input-group',
    props.fill ? 'bp3-fill' : '',
    props.large ? 'bp3-large' : '',
    props.disabled ? 'bp3-disabled' : '',
    props.className || '',
  ].filter(Boolean).join(' ');

  return (
    <view className={cls}>
      {props.leftIcon ? <Icon icon={props.leftIcon} className="bp3-input-icon" /> : null}
      <input
        className="bp3-input"
        value={props.value ?? ''}
        placeholder={props.placeholder}
        bindinput={(e: any) => { if (!props.disabled) props.onChange?.(e.detail?.value ?? ''); }}
        bindconfirm={(e: any) => { if (!props.disabled) props.onSubmit?.(e.detail?.value ?? props.value ?? ''); }}
      />
      {props.rightElement ? <view className="bp3-input-action">{props.rightElement}</view> : null}
    </view>
  );
}
