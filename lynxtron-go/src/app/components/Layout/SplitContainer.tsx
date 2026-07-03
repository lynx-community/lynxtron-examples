import { useState, useRef, useCallback } from '@lynx-js/react';
import './SplitContainer.css';
import { getExposed } from '../../store';

const log = (msg: string) => {
  try { getExposed()?.utils?.log(msg); } catch (_) {}
};

interface SplitContainerProps {
  direction: 'horizontal' | 'vertical';
  initialRatio?: number;
  minSizePx?: number;
  children: [JSX.Element, JSX.Element];
  onRatioChange?: (ratio: number) => void;
  /** When true, first pane fills 100% and sash/second pane are hidden (but still mounted). */
  collapsed?: boolean;
}

/**
 * A two-pane split container with a draggable sash between panes.
 * When dragging, a full-screen overlay captures all mouse/touch events
 * so fast mouse movement doesn't escape the narrow sash hit area.
 */
export function SplitContainer({
  direction,
  initialRatio = 0.2,
  minSizePx = 120,
  children,
  onRatioChange,
  collapsed = false,
}: SplitContainerProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startPos: 0, startRatio: 0, containerSize: 0 });
  const containerRef = useRef<{ size: number }>({ size: 0 });

  const isH = direction === 'horizontal';

  const getContainerSize = useCallback(() => {
    if (containerRef.current.size > 0) return containerRef.current.size;
    try {
      // @ts-ignore — Lynx global
      const info = lynx?.getSystemInfoSync?.() || {};
      const size = isH ? (info.screenWidth || 1200) : (info.screenHeight || 800);
      containerRef.current.size = size;
      return size;
    } catch {
      return isH ? 1200 : 800;
    }
  }, [isH]);

  // Extract position from Lynx touch or mouse event
  const getPos = (e: any): number | null => {
    const touch = e?.touches?.[0] || e?.changedTouches?.[0];
    if (touch) return isH ? touch.pageX : touch.pageY;
    if (e?.detail) {
      const v = isH ? (e.detail.pageX ?? e.detail.x) : (e.detail.pageY ?? e.detail.y);
      if (v != null) return v;
    }
    if (e?.pageX != null) return isH ? e.pageX : e.pageY;
    return null;
  };

  const onDragStart = useCallback((e: any) => {
    const pos = getPos(e);
    if (pos == null) return;
    const size = getContainerSize();
    dragRef.current = { startPos: pos, startRatio: ratio, containerSize: size };
    setDragging(true);
    log(`[Sash] start pos=${pos} ratio=${ratio} size=${size}`);
  }, [isH, ratio, getContainerSize]);

  const onDragMove = useCallback((e: any) => {
    const pos = getPos(e);
    if (pos == null) return;
    const { startPos, startRatio, containerSize } = dragRef.current;
    if (containerSize <= 0) return;

    const delta = pos - startPos;
    const ratioDelta = delta / containerSize;
    const minRatio = minSizePx / containerSize;
    const maxRatio = 1 - minRatio;
    const newRatio = Math.max(minRatio, Math.min(maxRatio, startRatio + ratioDelta));

    setRatio(newRatio);
    onRatioChange?.(newRatio);
  }, [isH, minSizePx, onRatioChange]);

  const onDragEnd = useCallback(() => {
    setDragging(false);
    log(`[Sash] end ratio=${ratio}`);
  }, [ratio]);

  const pct1 = collapsed ? '100%' : `${(ratio * 100).toFixed(2)}%`;
  const pct2 = collapsed ? '0%'   : `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <view className={`SplitContainer ${isH ? 'SplitH' : 'SplitV'}`}>
      <view
        className="SplitPane SplitFirst"
        style={isH ? { width: pct1, height: '100%' } : { height: pct1, width: '100%' }}
      >
        {children[0]}
      </view>

      {!collapsed && (
        <view
          className={`Sash ${isH ? 'SashH' : 'SashV'}`}
          bindtouchstart={onDragStart}
          bindtouchmove={onDragMove}
          bindtouchend={onDragEnd}
          bindmousedown={onDragStart}
          bindmousemove={onDragMove}
          bindmouseup={onDragEnd}
        />
      )}

      <view
        className="SplitPane SplitSecond"
        style={isH
          ? { width: pct2, height: '100%', overflow: 'hidden' }
          : { height: pct2, width: '100%', overflow: 'hidden' }}
      >
        {children[1]}
      </view>

      {/* Full-screen overlay during drag — captures mouse even if it leaves the sash */}
      {dragging && !collapsed && (
        <view
          className={`SashOverlay ${isH ? 'SashOverlayH' : 'SashOverlayV'}`}
          bindmousemove={onDragMove}
          bindmouseup={onDragEnd}
          bindtouchmove={onDragMove}
          bindtouchend={onDragEnd}
        />
      )}
    </view>
  );
}
