import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import type { Intent as IntentType } from './constants';
import './bp.css';

export interface AlertProps {
  isOpen: boolean;
  icon?: IconName;
  intent?: IntentType;
  confirmButtonText?: string;
  cancelButtonText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  children?: any;
}

export function Alert(props: AlertProps) {
  if (!props.isOpen) return null;
  const showCancel = typeof props.onCancel === 'function';
  return (
    <view className="bp3-dialog-overlay">
      <view className="bp3-alert">
        {props.icon ? (
          <view className="bp3-alert-icon">
            <Icon icon={props.icon} size={40} />
          </view>
        ) : null}
        <view className="bp3-alert-contents">
          {typeof props.children === 'string' ? (
            <text className="bp3-alert-message">{props.children}</text>
          ) : props.children}
        </view>
        <view className="bp3-alert-footer">
          {showCancel ? (
            <Button text={props.cancelButtonText ?? 'Cancel'} onClick={props.onCancel} />
          ) : null}
          <Button
            text={props.confirmButtonText ?? 'OK'}
            intent={props.intent}
            onClick={props.onConfirm}
          />
        </view>
      </view>
    </view>
  );
}
