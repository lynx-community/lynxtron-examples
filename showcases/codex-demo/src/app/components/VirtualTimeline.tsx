import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';
import type { TimelineEntry } from '../../shared/agent';
import { shouldRevealEarlierFromScroll } from '../timeline-scroll';
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
  hasEarlier?: boolean;
  loadingEarlier?: boolean;
  onReachStart?: () => void;
  onEarlierLayoutSettled?: () => void;
}

const INITIAL_ITEM_COUNT = 3;
const REVEAL_BATCH_SIZE = 3;
const LIST_VERTICAL_PADDING = 56;
const ITEM_BOTTOM_PADDING = 20;
const MIN_UPWARD_SCROLL_RANGE = 200;

function estimatedHeight(item: TimelineEntry): number {
  if (item.kind === 'tool') return item.tool?.text ? 150 : 88;
  if (item.kind === 'plan') return 54 + (item.plan?.length ?? 0) * 34;
  const textLength = item.text?.length ?? 0;
  const textHeight = Math.ceil(textLength / 66) * 22;
  if (item.kind === 'user') return Math.min(560, Math.max(62, textHeight + 36));
  return Math.min(900, Math.max(54, textHeight + 30));
}

function TimelineListItem({
  item,
  onMeasured,
  renderItem,
}: {
  item: TimelineEntry;
  onMeasured: (itemKey: string, height: number) => void;
  renderItem: (item: TimelineEntry) => any;
}) {
  const minimumTextHeight = item.kind === 'assistant' || item.kind === 'user'
    ? estimatedHeight(item)
    : 0;
  const handleItemLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height >= 0) {
      onMeasured(item.id, layout.height);
    }
  }, [item.id, onMeasured]);

  return (
    <list-item
      item-key={item.id}
      className="virtual-timeline-item"
      estimated-main-axis-size-px={estimatedHeight(item)}
      bindlayoutchange={handleItemLayoutChange}
    >
      <view
        className="virtual-timeline-item-content"
        style={minimumTextHeight > 0 ? { minHeight: `${minimumTextHeight}px` } : undefined}
      >
        {renderItem(item)}
      </view>
    </list-item>
  );
}

export const VirtualTimeline = forwardRef<VirtualTimelineHandle, VirtualTimelineProps>(function VirtualTimeline({
  id,
  items,
  renderItem,
  footer,
  hasEarlier = false,
  loadingEarlier = false,
  onReachStart,
  onEarlierLayoutSettled,
}, ref) {
  const initialPositioningComplete = useRef(false);
  const topTriggerLatched = useRef(false);
  const previousItems = useRef({
    length: items.length,
    firstId: items[0]?.id,
  });
  const pendingScroll = useRef<{ itemKey: string; position?: number; alignTo: string; smooth: boolean } | null>(null);
  const awaitingEarlierLayout = useRef(false);
  const [visibleCount, setVisibleCount] = useState(() => Math.min(INITIAL_ITEM_COUNT, items.length));
  const [revealingEarlier, setRevealingEarlier] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measuredItemHeights, setMeasuredItemHeights] = useState<Record<string, number>>({});
  const [footerHeight, setFooterHeight] = useState(0);

  const visibleItems = useMemo(
    () => items.slice(Math.max(0, items.length - visibleCount)),
    [items, visibleCount],
  );

  const measuredContentHeight = useMemo(
    () => visibleItems.reduce(
      (height, item) => height + (measuredItemHeights[item.id] ?? estimatedHeight(item)),
      0,
    ),
    [measuredItemHeights, visibleItems],
  );

  const allVisibleItemsMeasured = visibleItems.every(
    (item) => measuredItemHeights[item.id] !== undefined,
  );

  const topSpacerHeight = visibleCount >= items.length
    ? Math.max(
      0,
      viewportHeight
        - LIST_VERTICAL_PADDING
        - measuredContentHeight
        - (footer ? footerHeight + ITEM_BOTTOM_PADDING : 0),
    )
    : 0;

  const invokeListMethod = useCallback((
    method: string,
    params: Record<string, unknown>,
    onSuccess?: () => void,
  ) => {
    try {
      lynx.createSelectorQuery()
        .select(`#${id}`)
        .invoke({
          method,
          params,
          success: () => onSuccess?.(),
          fail: () => {},
        })
        .exec();
    } catch (_) {}
  }, [id]);

  const invokeScroll = useCallback((params: Record<string, unknown>, onSuccess?: () => void) => {
    invokeListMethod('scrollToPosition', params, onSuccess);
  }, [invokeListMethod]);

  const scrollToIndex = useCallback((index: number, smooth = false) => {
    if (items.length === 0) return;
    const targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(index)));
    const target = items[targetIndex];
    if (targetIndex >= items.length - visibleCount) {
      invokeScroll({ position: targetIndex, itemKey: target.id, alignTo: 'middle', smooth });
      return;
    }
    pendingScroll.current = { itemKey: target.id, alignTo: 'middle', smooth };
    setVisibleCount((current) => Math.max(current, items.length - targetIndex));
  }, [invokeScroll, items, visibleCount]);

  const scrollToItem = useCallback((itemKey: string, smooth = false) => {
    const targetIndex = items.findIndex((item) => item.id === itemKey);
    if (targetIndex < 0) return;
    if (targetIndex >= items.length - visibleCount) {
      invokeScroll({ position: targetIndex, itemKey, alignTo: 'middle', smooth });
      return;
    }
    pendingScroll.current = { itemKey, alignTo: 'middle', smooth };
    setVisibleCount((current) => Math.max(current, items.length - targetIndex));
  }, [invokeScroll, items, visibleCount]);

  const scrollToTail = useCallback((smooth = false) => {
    if (visibleItems.length === 0) return;
    invokeListMethod('autoScroll', {
      rate: smooth ? '2400px' : '100000px',
      start: true,
      autoStop: true,
    });
  }, [invokeListMethod, visibleItems.length]);

  const revealEarlier = useCallback(() => {
    if (!initialPositioningComplete.current || topTriggerLatched.current) return;
    topTriggerLatched.current = true;
    if (visibleCount < items.length) {
      const addedCount = Math.min(REVEAL_BATCH_SIZE, items.length - visibleCount);
      const anchorItem = visibleItems[0];
      setRevealingEarlier(true);
      if (anchorItem) {
        pendingScroll.current = {
          itemKey: anchorItem.id,
          position: addedCount,
          alignTo: 'top',
          smooth: false,
        };
      }
      setVisibleCount((current) => Math.min(items.length, current + addedCount));
      return;
    }
    const anchorItem = visibleItems[0];
    if (hasEarlier && anchorItem) {
      pendingScroll.current = {
        itemKey: anchorItem.id,
        position: REVEAL_BATCH_SIZE,
        alignTo: 'top',
        smooth: false,
      };
      awaitingEarlierLayout.current = true;
    }
    onReachStart?.();
  }, [hasEarlier, items.length, onReachStart, visibleCount, visibleItems]);

  const handleLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height > 0) {
      setViewportHeight(layout.height);
    }
  }, []);

  const handleItemMeasured = useCallback((itemKey: string, height: number) => {
    setMeasuredItemHeights((current) => current[itemKey] === height
      ? current
      : { ...current, [itemKey]: height });
  }, []);

  const handleFooterLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height >= 0) {
      setFooterHeight(layout.height);
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    if (shouldRevealEarlierFromScroll(detail)) {
      revealEarlier();
      return;
    }
    if (typeof detail.scrollTop === 'number' && detail.scrollTop > 16) {
      topTriggerLatched.current = false;
    }
  }, [revealEarlier]);

  const handleReachStart = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    if (!shouldRevealEarlierFromScroll(detail)) return;
    revealEarlier();
  }, [revealEarlier]);

  useImperativeHandle(ref, () => ({ scrollToIndex, scrollToItem, scrollToTail }), [
    scrollToIndex,
    scrollToItem,
    scrollToTail,
  ]);

  useEffect(() => {
    const previous = previousItems.current;
    previousItems.current = { length: items.length, firstId: items[0]?.id };

    if (items.length < previous.length) {
      setVisibleCount(Math.min(INITIAL_ITEM_COUNT, items.length));
      return;
    }
    if (items.length > previous.length && previous.length > 0 && items[0]?.id === previous.firstId) {
      setVisibleCount((current) => Math.min(items.length, current + items.length - previous.length));
      return;
    }
    if (items.length > previous.length && visibleCount >= previous.length) {
      const addedCount = items.length - previous.length;
      setVisibleCount((current) => Math.min(items.length, current + Math.min(REVEAL_BATCH_SIZE, addedCount)));
    }
  }, [items.length, visibleCount]);

  const handleLayoutComplete = useCallback(() => {
    const request = pendingScroll.current;
    if (!request) return;
    if (!visibleItems.some((item) => item.id === request.itemKey)) return;
    pendingScroll.current = null;
    setTimeout(
      () => invokeScroll(
        { position: request.position ?? 0, ...request },
        () => {
          topTriggerLatched.current = false;
          setRevealingEarlier(false);
          if (awaitingEarlierLayout.current) {
            awaitingEarlierLayout.current = false;
            onEarlierLayoutSettled?.();
          }
        },
      ),
      0,
    );
  }, [invokeScroll, onEarlierLayoutSettled, visibleItems]);

  useEffect(() => {
    if (
      viewportHeight <= 0
      || initialPositioningComplete.current
      || visibleItems.length === 0
      || !allVisibleItemsMeasured
    ) return;
    const actualContentHeight = measuredContentHeight
      + LIST_VERTICAL_PADDING
      + (footer ? footerHeight + ITEM_BOTTOM_PADDING : 0);
    const targetContentHeight = viewportHeight + MIN_UPWARD_SCROLL_RANGE;
    if (actualContentHeight < targetContentHeight && visibleCount < items.length) {
      setVisibleCount((current) => Math.min(items.length, current + REVEAL_BATCH_SIZE));
      return;
    }
    const firstPass = setTimeout(() => scrollToTail(false), 32);
    const settlePass = setTimeout(() => {
      scrollToTail(false);
      initialPositioningComplete.current = true;
      topTriggerLatched.current = false;
    }, 120);
    return () => {
      clearTimeout(firstPass);
      clearTimeout(settlePass);
    };
  }, [
    allVisibleItemsMeasured,
    footer,
    footerHeight,
    items.length,
    measuredContentHeight,
    scrollToTail,
    viewportHeight,
    visibleCount,
    visibleItems,
  ]);

  return (
    <list
      id={id}
      className="virtual-timeline"
      bindlayoutchange={handleLayoutChange}
      bindlayoutcomplete={handleLayoutComplete}
      bindscroll={handleScroll}
      scroll-orientation="vertical"
      list-type="single"
      enable-scroll={true}
      initial-scroll-index={visibleItems.length}
      need-layout-complete-info={true}
      layout-id={visibleItems.length}
      upper-threshold-item-count={1}
      preload-buffer-count={4}
      experimental-search-ref-anchor-strategy={1}
      bindscrolltoupper={handleReachStart}
    >
      {loadingEarlier || revealingEarlier ? (
        <list-item
          item-key="__timeline-history-loader"
          className="virtual-timeline-loader"
          estimated-main-axis-size-px={42}
          recyclable={false}
        >
          <view className="virtual-timeline-loader-content">
            <view className="virtual-timeline-loader-ring" />
            <text className="virtual-timeline-loader-text">Loading earlier messages…</text>
          </view>
        </list-item>
      ) : null}
      {topSpacerHeight > 0 ? (
        <list-item
          item-key="__timeline-top-spacer"
          className="virtual-timeline-top-spacer"
          estimated-main-axis-size-px={topSpacerHeight}
          recyclable={false}
        >
          <view className="virtual-timeline-top-spacer-content" style={{ height: `${topSpacerHeight}px` }} />
        </list-item>
      ) : null}
      {visibleItems.map((item) => (
        <TimelineListItem
          key={item.id}
          item={item}
          onMeasured={handleItemMeasured}
          renderItem={renderItem}
        />
      ))}
      {footer ? (
        <list-item item-key="__timeline-footer" className="virtual-timeline-footer" recyclable={false}>
          <view className="virtual-timeline-item-content" bindlayoutchange={handleFooterLayoutChange}>
            {footer}
          </view>
        </list-item>
      ) : null}
    </list>
  );
});
