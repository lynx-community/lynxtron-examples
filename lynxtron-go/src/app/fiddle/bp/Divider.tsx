import './bp.css';

export interface DividerProps {
  vertical?: boolean;
  className?: string;
}

export function Divider(props: DividerProps) {
  const cls = ['bp3-divider', props.vertical ? 'bp3-vertical' : '', props.className || '']
    .filter(Boolean)
    .join(' ');
  return <view className={cls} />;
}
