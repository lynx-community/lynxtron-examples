import { Icon, type IconName } from './Icon';
import { Intent } from './constants';
import './bp.css';

export interface ButtonProps {
  text?: string;
  icon?: IconName;
  /**
   * Leading visual that is not a glyph from the icon font — an image, a mark.
   * Takes the icon's slot, so the two are alternatives rather than a stack.
   */
  iconNode?: any;
  rightIcon?: IconName;
  intent?: Intent;
  active?: boolean;
  disabled?: boolean;
  minimal?: boolean;
  fill?: boolean;
  large?: boolean;
  small?: boolean;
  title?: string;
  onClick?: () => void;
  className?: string;
  children?: any;
}

export function Button(props: ButtonProps) {
  const cls = [
    'bp3-button',
    props.minimal ? 'bp3-minimal' : '',
    props.active ? 'bp3-active' : '',
    props.disabled ? 'bp3-disabled' : '',
    props.fill ? 'bp3-fill' : '',
    props.large ? 'bp3-large' : '',
    props.small ? 'bp3-small' : '',
    props.intent && props.intent !== Intent.NONE ? `bp3-intent-${props.intent}` : '',
    props.className || '',
  ].filter(Boolean).join(' ');

  const handleTap = () => {
    if (props.disabled) return;
    props.onClick?.();
  };

  return (
    <view className={cls} bindtap={handleTap}>
      {props.iconNode ?? (props.icon ? <Icon icon={props.icon} className="bp3-button-icon" /> : null)}
      {props.text ? <text className="bp3-button-text">{props.text}</text> : null}
      {props.children}
      {props.rightIcon ? <Icon icon={props.rightIcon} className="bp3-button-icon" /> : null}
    </view>
  );
}
