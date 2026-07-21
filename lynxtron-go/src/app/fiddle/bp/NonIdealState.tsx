import { Icon, type IconName } from './Icon';
import './bp.css';

export interface NonIdealStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: any;
}

export function NonIdealState(props: NonIdealStateProps) {
  return (
    <view className="bp3-non-ideal-state">
      {props.icon ? (
        <view className="bp3-non-ideal-state-visual">
          <Icon icon={props.icon} size={48} />
        </view>
      ) : null}
      <text className="bp3-non-ideal-state-title">{props.title}</text>
      {props.description ? (
        <text className="bp3-non-ideal-state-description">{props.description}</text>
      ) : null}
      {props.action ? (
        <view className="bp3-non-ideal-state-action">{props.action}</view>
      ) : null}
    </view>
  );
}
