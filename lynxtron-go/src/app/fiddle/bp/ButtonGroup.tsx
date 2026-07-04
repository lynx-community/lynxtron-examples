import './bp.css';

export interface ButtonGroupProps {
  fill?: boolean;
  vertical?: boolean;
  minimal?: boolean;
  className?: string;
  children?: any;
}

export function ButtonGroup(props: ButtonGroupProps) {
  const cls = [
    'bp3-button-group',
    props.fill ? 'bp3-fill' : '',
    props.vertical ? 'bp3-vertical' : '',
    props.minimal ? 'bp3-minimal' : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  return <view className={cls}>{props.children}</view>;
}
