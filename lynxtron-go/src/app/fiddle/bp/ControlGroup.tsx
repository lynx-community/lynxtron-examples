import './bp.css';

export interface ControlGroupProps {
  fill?: boolean;
  vertical?: boolean;
  className?: string;
  children?: any;
}

export function ControlGroup(props: ControlGroupProps) {
  const cls = [
    'bp3-control-group',
    props.fill ? 'bp3-fill' : '',
    props.vertical ? 'bp3-vertical' : '',
    props.className || '',
  ].filter(Boolean).join(' ');
  // Positional classes instead of :first-child/:last-child — Lynx doesn't
  // apply those pseudo-classes here, so fused-corner styling is structural.
  const kids = (Array.isArray(props.children) ? props.children : [props.children]).filter(Boolean);
  const last = kids.length - 1;
  return (
    <view className={cls}>
      {kids.map((child, i) => (
        <view
          key={i}
          className={
            'bp3-cg-item'
            + (i === 0 ? ' bp3-cg-item--first' : '')
            + (i === last ? ' bp3-cg-item--last' : '')
          }
        >
          {child}
        </view>
      ))}
    </view>
  );
}
