import { Button } from './Button';
import './bp.css';
import { PlatformOverlay } from '../../components/shared/PlatformOverlay';

export interface DialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children?: any;
  footer?: any;
  width?: number;
}

export function Dialog(props: DialogProps) {
  if (!props.isOpen) return null;
  const style = props.width ? { width: props.width + 'px' } as any : undefined;
  return (
    <PlatformOverlay priority={100}>
      <view className="bp3-dialog-overlay">
        <view className="bp3-dialog" style={style}>
        <view className="bp3-dialog-header">
          <text className="bp3-dialog-title">{props.title}</text>
          <Button icon="cross" minimal onClick={props.onClose} />
        </view>
        <view className="bp3-dialog-body">{props.children}</view>
        {props.footer ? <view className="bp3-dialog-footer">{props.footer}</view> : null}
        </view>
      </view>
    </PlatformOverlay>
  );
}
