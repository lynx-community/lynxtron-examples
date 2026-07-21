import type { Intent as IntentType } from './constants';
import './bp.css';

export interface TagProps {
  intent?: IntentType;
  minimal?: boolean;
  large?: boolean;
  round?: boolean;
  onRemove?: () => void;
  className?: string;
  children?: any;
}

export function Tag(props: TagProps) {
  const cls = [
    'bp3-tag',
    props.minimal ? 'bp3-minimal' : '',
    props.large ? 'bp3-large' : '',
    props.round ? 'bp3-round' : '',
    props.intent && props.intent !== 'none' ? 'bp3-intent-' + props.intent : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  return (
    <view className={cls}>
      <text className="bp3-tag-text">{props.children}</text>
      {props.onRemove ? (
        <view className="bp3-tag-remove" bindtap={props.onRemove}>
          <text className="bp3-tag-remove-text">✕</text>
        </view>
      ) : null}
    </view>
  );
}
