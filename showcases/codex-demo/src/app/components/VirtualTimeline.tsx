import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from '@lynx-js/react';
import type { TimelineEntry } from '../../shared/agent';
import './VirtualTimeline.css';

export interface VirtualTimelineHandle {
  scrollToIndex: (index: number, smooth?: boolean) => void;
  scrollToItem: (itemKey: string, smooth?: boolean) => void;
  scrollToTail: (smooth?: boolean) => void;
}

interface VirtualTimelineProps {
  id: string;
  items: TimelineEntry[];
  renderItem: (item: TimelineEntry) => any;
  footer?: any;
  onReachStart?: () => void;
}

function estimatedHeight(item: TimelineEntry): number {
  if (item.kind === 'tool') return item.tool?.text ? 150 : 88;
  if (item.kind === 'plan') return 54 + (item.plan?.length ?? 0) * 34;
  const textLength = item.text?.length ?? 0;
  const textHeight = Math.ceil(textLength / 66) * 22;
  if (item.kind === 'user') return Math.min(560, Math.max(62, textHeight + 36));
  return Math.min(900, Math.max(54, textHeight + 30));
}

export const VirtualTimeline = forwardRef<VirtualTimelineHandle, VirtualTimelineProps>(function VirtualTimeline({
  id,
  items,
  renderItem,
  footer,
  onReachStart,
}, ref) {
  const didPositionInitially = useRef(false);

  const invokeScroll = useCallback((params: Record<string, unknown>) => {
    try {
      lynx.createSelectorQuery()
        .select(`#${id}`)
        .invoke({
          method: 'scrollToPosition',
          params,
          success: () => {},
          fail: () => {},
        })
        .exec();
    } catch (_) {}
  }, [id]);

  const scrollToIndex = useCallback((index: number, smooth = false) => {
    if (items.length === 0) return;
    invokeScroll({
      index: Math.max(0, Math.min(items.length - 1, Math.floor(index))),
      alignTo: 'middle',
      smooth,
    });
  }, [invokeScroll, items.length]);

  const scrollToItem = useCallback((itemKey: string, smooth = false) => {
    invokeScroll({ index: 0, itemKey, alignTo: 'middle', smooth });
  }, [invokeScroll]);

  const scrollToTail = useCallback((smooth = false) => {
    if (items.length === 0) return;
    invokeScroll(footer
      ? { index: items.length, itemKey: '__timeline-footer', alignTo: 'bottom', smooth }
      : { index: items.length - 1, alignTo: 'bottom', smooth });
  }, [footer, invokeScroll, items.length]);

  useImperativeHandle(ref, () => ({ scrollToIndex, scrollToItem, scrollToTail }), [
    scrollToIndex,
    scrollToItem,
    scrollToTail,
  ]);

  useEffect(() => {
    if (didPositionInitially.current || items.length === 0) return;
    didPositionInitially.current = true;
    scrollToTail(false);
  }, [items.length, scrollToTail]);

  return (
    <list
      id={id}
      className="virtual-timeline"
      scroll-orientation="vertical"
      list-type="single"
      enable-scroll={true}
      initial-scroll-index={Math.max(0, items.length - (footer ? 0 : 1))}
      upper-threshold-item-count={8}
      preload-buffer-count={4}
      experimental-search-ref-anchor-strategy={1}
      bindscrolltoupper={onReachStart}
    >
      {items.map((item) => (
        <list-item
          key={item.id}
          item-key={item.id}
          className="virtual-timeline-item"
          estimated-main-axis-size-px={estimatedHeight(item)}
        >
          {renderItem(item)}
        </list-item>
      ))}
      {footer ? (
        <list-item item-key="__timeline-footer" className="virtual-timeline-footer" recyclable={false}>
          {footer}
        </list-item>
      ) : null}
    </list>
  );
});
