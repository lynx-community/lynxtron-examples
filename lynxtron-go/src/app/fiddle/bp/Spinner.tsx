import './bp.css';

export interface SpinnerProps {
  size?: number;
  intent?: 'none' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function Spinner(props: SpinnerProps) {
  const size = props.size ?? 16;
  const cls = [
    'bp3-spinner',
    props.intent && props.intent !== 'none' ? 'bp3-intent-' + props.intent : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  const style: any = { width: size + 'px', height: size + 'px' };
  return (
    <view className={cls} style={style}>
      <view className="bp3-spinner-ring" style={style} />
    </view>
  );
}
