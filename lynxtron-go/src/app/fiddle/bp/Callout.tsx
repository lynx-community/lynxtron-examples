import { Icon, type IconName } from './Icon';
import { Intent } from './constants';
import './bp.css';

export interface CalloutProps {
  intent?: Intent;
  icon?: IconName;
  title?: string;
  className?: string;
  children?: any;
}

export function Callout(props: CalloutProps) {
  const cls = [
    'bp3-callout',
    props.intent && props.intent !== Intent.NONE ? `bp3-intent-${props.intent}` : '',
    props.icon ? 'bp3-callout-icon' : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  return (
    <view className={cls}>
      {props.icon ? <Icon icon={props.icon} className="bp3-callout-icon-glyph" /> : null}
      {props.title ? <text className="bp3-callout-title">{props.title}</text> : null}
      {typeof props.children === 'string' ? (
        <text className="bp3-callout-body">{props.children}</text>
      ) : props.children}
    </view>
  );
}
