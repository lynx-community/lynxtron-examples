import { useEffect, useRef, useState } from '@lynx-js/react';
import './Popover.css';

export type PopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/** Shared anchored floating surface with dismissal and motion behavior. */
export interface PopoverProps {
  open: boolean;
  onRequestClose: () => void;
  children?: any;
  className?: string;
  placement?: PopoverPlacement;
  offset?: number;
  style?: Record<string, unknown>;
}

const EXIT_DURATION_MS = 110;

export function Popover({
  open,
  onRequestClose,
  children,
  className = '',
  placement = 'bottom-start',
  offset = 8,
  style,
}: PopoverProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opensUpward = placement.startsWith('top');

  useEffect(() => {
    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
      animationTimer.current = null;
    }
    if (open) {
      setRendered(true);
      if (opensUpward && measuredHeight <= 0) return;
      animationTimer.current = setTimeout(() => {
        animationTimer.current = null;
        setVisible(true);
      }, 16);
      return;
    }
    setVisible(false);
    animationTimer.current = setTimeout(() => {
      animationTimer.current = null;
      setRendered(false);
    }, EXIT_DURATION_MS);
    return () => {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
        animationTimer.current = null;
      }
    };
  }, [measuredHeight, open, opensUpward]);

  useEffect(() => {
    if (!open) return;
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const handleWindowBlur = () => onRequestClose();
    emitter.addListener('window:blur', handleWindowBlur);
    return () => emitter.removeListener('window:blur', handleWindowBlur);
  }, [onRequestClose, open]);

  useEffect(() => () => {
    if (animationTimer.current) clearTimeout(animationTimer.current);
  }, []);

  const handleLayoutChange = (event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height > 0 && layout.height !== measuredHeight) {
      setMeasuredHeight(layout.height);
    }
  };

  if (!rendered) return null;
  const popoverStyle: Record<string, unknown> = {
    top: `${opensUpward ? -(measuredHeight + offset) : offset}px`,
    ...style,
  };

  return (
    <view className={`ui-popover-layer ui-popover-layer--${opensUpward ? 'top' : 'bottom'}`}>
      <view className="ui-popover-dismiss-layer" bindtap={onRequestClose} />
      <view
        className={`ui-popover ui-popover--${placement} ${visible ? 'ui-popover--visible' : ''} ${className}`}
        style={popoverStyle}
        bindlayoutchange={handleLayoutChange}
      >
        {children}
      </view>
    </view>
  );
}
