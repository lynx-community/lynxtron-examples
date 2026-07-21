import './bp.css';

export interface CardProps {
  elevation?: 0 | 1 | 2 | 3 | 4;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  children?: any;
}

export function Card(props: CardProps) {
  const cls = [
    'bp3-card',
    props.interactive ? 'bp3-interactive' : '',
    'bp3-elevation-' + (props.elevation ?? 0),
    props.className || '',
  ].filter(Boolean).join(' ');
  return <view className={cls} bindtap={props.onClick}>{props.children}</view>;
}
