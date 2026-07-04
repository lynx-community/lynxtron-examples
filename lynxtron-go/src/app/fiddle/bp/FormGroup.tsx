import './bp.css';

export interface FormGroupProps {
  label?: string;
  helperText?: string;
  className?: string;
  children?: any;
}

export function FormGroup(props: FormGroupProps) {
  const cls = ['bp3-form-group', props.className || ''].filter(Boolean).join(' ');
  return (
    <view className={cls}>
      {props.label ? <text className="bp3-form-group-label">{props.label}</text> : null}
      <view className="bp3-form-group-content">{props.children}</view>
      {props.helperText ? <text className="bp3-form-group-helper">{props.helperText}</text> : null}
    </view>
  );
}
