import { Icon, type IconName } from './Icon';
import './bp.css';

export interface MenuProps {
  className?: string;
  children?: any;
}

export function Menu(props: MenuProps) {
  const cls = 'bp3-menu' + (props.className ? ' ' + props.className : '');
  return <view className={cls}>{props.children}</view>;
}

export interface MenuItemProps {
  text: string;
  icon?: IconName;
  intent?: 'none' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  active?: boolean;
  label?: string;
  onClick?: () => void;
}

export function MenuItem(props: MenuItemProps) {
  const cls = [
    'bp3-menu-item',
    props.disabled ? 'bp3-disabled' : '',
    props.active ? 'bp3-active' : '',
    props.intent && props.intent !== 'none' ? 'bp3-intent-' + props.intent : '',
  ].filter(Boolean).join(' ');
  const handleTap = () => { if (!props.disabled) props.onClick?.(); };
  return (
    <view className={cls} bindtap={handleTap}>
      {props.icon ? <Icon icon={props.icon} className="bp3-menu-item-icon" /> : null}
      <text className="bp3-menu-item-text">{props.text}</text>
      {props.label ? <text className="bp3-menu-item-label">{props.label}</text> : null}
    </view>
  );
}

export interface MenuDividerProps {
  title?: string;
}

export function MenuDivider(props: MenuDividerProps) {
  if (props.title) {
    return (
      <view className="bp3-menu-header">
        <text className="bp3-menu-header-text">{props.title}</text>
      </view>
    );
  }
  return <view className="bp3-menu-divider" />;
}
