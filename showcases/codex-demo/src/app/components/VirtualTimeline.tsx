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
  onReachStart?: (traceId?: string) => void;
  onEarlierLayoutSettled?: () => void;
  onRevealPerformance?: (metrics: Record<string, unknown>) => void;
}

const INITIAL_ITEM_COUNT = 3;
const REVEAL_BATCH_SIZE = 3;
const PREFETCH_BUFFER_ITEMS = 6;
const PREFETCH_REFILL_ITEMS = 9;
const PREFETCH_COOLDOWN_MS = 250;
const LIST_VERTICAL_PADDING = 56;
const ITEM_BOTTOM_PADDING = 20;
const MIN_UPWARD_SCROLL_RANGE = 200;
let revealTraceSequence = 0;

interface RevealTrace {
  traceId: string;
  startedAt: number;
  mode: 'local-batch' | 'remote-page';
  previousFirstId?: string;
  previousVisibleIds: Set<string>;
  firstItemLayoutReported: boolean;
  elementOnScreenReported: boolean;
  anchorScrollSucceeded: boolean;
}

function visibleAnchor(detail: any, visibleItems: TimelineEntry[]): { itemKey: string; index: number } | null {
  if (!Array.isArray(detail?.attachedCells)) return null;
  const indices = new Map(visibleItems.map((item, index) => [item.id, index]));
  let anchor: { itemKey: string; index: number } | null = null;
  for (const cell of detail.attachedCells) {
    const itemKey = cell?.itemKey ?? cell?.['item-key'];
    const index = typeof itemKey === 'string' ? indices.get(itemKey) : undefined;
    if (index === undefined || (anchor && anchor.index <= index)) continue;
    anchor = { itemKey, index };
  }
  return anchor;
}

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
  onRevealPerformance,
}, ref) {
  const initialPositioningComplete = useRef(false);
  const topTriggerLatched = useRef(false);
  const previousItems = useRef({
    length: items.length,
    firstId: items[0]?.id,
  });
  const pendingScroll = useRef<{ itemKey: string; position?: number; alignTo: string; smooth: boolean } | null>(null);
  const awaitingEarlierLayout = useRef(false);
  const pendingEarlierRevealCount = useRef(REVEAL_BATCH_SIZE);
  const lastRevealAt = useRef(0);
  const revealTrace = useRef<RevealTrace | null>(null);
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

  const reportRevealPhase = useCallback((phase: string, extra: Record<string, unknown> = {}) => {
    const trace = revealTrace.current;
    if (!trace) return;
    onRevealPerformance?.({
      traceId: trace.traceId,
      phase,
      mode: trace.mode,
      elapsedMs: Date.now() - trace.startedAt,
      ...extra,
    });
  }, [onRevealPerformance]);

  const revealEarlier = useCallback((anchorItemKey?: string, availableAbove = 0) => {
    const now = Date.now();
    if (!initialPositioningComplete.current
      || topTriggerLatched.current
      || now - lastRevealAt.current < PREFETCH_COOLDOWN_MS) return;
    lastRevealAt.current = now;
    topTriggerLatched.current = true;
    const desiredAddedCount = Math.max(
      PREFETCH_REFILL_ITEMS,
      PREFETCH_BUFFER_ITEMS - availableAbove + PREFETCH_REFILL_ITEMS,
    );
    if (visibleCount < items.length) {
      const addedCount = Math.min(desiredAddedCount, items.length - visibleCount);
      const anchorIndex = Math.max(0, visibleItems.findIndex((item) => item.id === anchorItemKey));
      const anchorItem = visibleItems[anchorIndex] ?? visibleItems[0];
      revealTrace.current = {
        traceId: `timeline-reveal-${Date.now()}-${++revealTraceSequence}`,
        startedAt: Date.now(),
        mode: 'local-batch',
        previousFirstId: anchorItem?.id,
        previousVisibleIds: new Set(visibleItems.map((item) => item.id)),
        firstItemLayoutReported: false,
        elementOnScreenReported: false,
        anchorScrollSucceeded: false,
      };
      reportRevealPhase('buffer-trigger', {
        visibleCount,
        totalItemCount: items.length,
        availableAbove,
        bufferTarget: PREFETCH_BUFFER_ITEMS,
        addedCount,
      });
      setRevealingEarlier(true);
      if (anchorItem) {
        pendingScroll.current = {
          itemKey: anchorItem.id,
          position: anchorIndex + addedCount,
          alignTo: 'top',
          smooth: false,
        };
      }
      setVisibleCount((current) => Math.min(items.length, current + addedCount));
      reportRevealPhase('state-update-scheduled');
      return;
    }
    const anchorIndex = Math.max(0, visibleItems.findIndex((item) => item.id === anchorItemKey));
    const anchorItem = visibleItems[anchorIndex] ?? visibleItems[0];
    if (hasEarlier && anchorItem) {
      revealTrace.current = {
        traceId: `timeline-reveal-${Date.now()}-${++revealTraceSequence}`,
        startedAt: Date.now(),
        mode: 'remote-page',
        previousFirstId: anchorItem.id,
        previousVisibleIds: new Set(visibleItems.map((item) => item.id)),
        firstItemLayoutReported: false,
        elementOnScreenReported: false,
        anchorScrollSucceeded: false,
      };
      reportRevealPhase('buffer-trigger', {
        visibleCount,
        totalItemCount: items.length,
        availableAbove,
        bufferTarget: PREFETCH_BUFFER_ITEMS,
        requestedCount: desiredAddedCount,
      });
      pendingScroll.current = {
        itemKey: anchorItem.id,
        position: anchorIndex + desiredAddedCount,
        alignTo: 'top',
        smooth: false,
      };
      pendingEarlierRevealCount.current = desiredAddedCount;
      awaitingEarlierLayout.current = true;
      reportRevealPhase('history-request-dispatched');
    }
    onReachStart?.(revealTrace.current?.traceId);
  }, [hasEarlier, items.length, onReachStart, reportRevealPhase, visibleCount, visibleItems]);

  const handleLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height > 0) {
      setViewportHeight(layout.height);
    }
  }, []);

  const handleItemMeasured = useCallback((itemKey: string, height: number) => {
    const trace = revealTrace.current;
    if (trace && !trace.firstItemLayoutReported && !trace.previousVisibleIds.has(itemKey)) {
      trace.firstItemLayoutReported = true;
      reportRevealPhase('first-prepended-item-layout', { itemKey, height });
    }
    setMeasuredItemHeights((current) => current[itemKey] === height
      ? current
      : { ...current, [itemKey]: height });
  }, [reportRevealPhase]);

  const handleFooterLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    const layout = detail.layout ?? detail;
    if (typeof layout.height === 'number' && layout.height >= 0) {
      setFooterHeight(layout.height);
    }
  }, []);

  const reportNewVisibleCell = useCallback((cells: any[] | undefined, source: string) => {
    const trace = revealTrace.current;
    if (!trace || trace.elementOnScreenReported || !Array.isArray(cells)) return;
    const cell = cells.find((candidate) => {
      const itemKey = candidate?.itemKey ?? candidate?.['item-key'];
      return typeof itemKey === 'string'
        && !itemKey.startsWith('__timeline-')
        && !trace.previousVisibleIds.has(itemKey);
    });
    if (!cell) return;
    trace.elementOnScreenReported = true;
    reportRevealPhase('element-on-screen', {
      source,
      itemKey: cell.itemKey ?? cell['item-key'],
      top: cell.top ?? cell.originY,
      bottom: cell.bottom,
    });
    if (trace.anchorScrollSucceeded) revealTrace.current = null;
  }, [reportRevealPhase]);

  const handleScroll = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    reportNewVisibleCell(detail.attachedCells, 'scroll-attached-cells');
    const anchor = visibleAnchor(detail, visibleItems);
    if (detail.eventSource === 2 && anchor && anchor.index <= PREFETCH_BUFFER_ITEMS) {
      revealEarlier(anchor.itemKey, anchor.index);
      return;
    }
    if (shouldRevealEarlierFromScroll(detail)) {
      revealEarlier();
      return;
    }
  }, [reportNewVisibleCell, revealEarlier, visibleItems]);

  const handleReachStart = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    if (detail.eventSource !== 2 && !shouldRevealEarlierFromScroll(detail)) return;
    const anchor = visibleAnchor(detail, visibleItems);
    revealEarlier(anchor?.itemKey, anchor?.index ?? 0);
  }, [revealEarlier, visibleItems]);

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
      const revealCount = Math.min(pendingEarlierRevealCount.current, addedCount);
      pendingEarlierRevealCount.current = REVEAL_BATCH_SIZE;
      setVisibleCount((current) => Math.min(items.length, current + revealCount));
    }
  }, [items.length, visibleCount]);

  const handleLayoutComplete = useCallback((event: any) => {
    const detail = event?.detail ?? {};
    reportNewVisibleCell(detail.visibleCellsAfterUpdate, 'layout-complete-visible-cells');
    const request = pendingScroll.current;
    if (!request) return;
    if (!visibleItems.some((item) => item.id === request.itemKey)) return;
    reportRevealPhase('list-layout-complete', {
      visibleCount: visibleItems.length,
      firstVisibleItemId: visibleItems[0]?.id,
    });
    pendingScroll.current = null;
    reportRevealPhase('anchor-scroll-invoked');
    setTimeout(
      () => invokeScroll(
        { position: request.position ?? 0, ...request },
        () => {
          setTimeout(() => {
            topTriggerLatched.current = false;
          }, PREFETCH_COOLDOWN_MS);
          setRevealingEarlier(false);
          if (awaitingEarlierLayout.current) {
            awaitingEarlierLayout.current = false;
            onEarlierLayoutSettled?.();
          }
          const trace = revealTrace.current;
          if (trace) {
            trace.anchorScrollSucceeded = true;
            reportRevealPhase('anchor-scroll-success', { itemKey: request.itemKey });
            if (trace.elementOnScreenReported) revealTrace.current = null;
          }
        },
      ),
      0,
    );
  }, [invokeScroll, onEarlierLayoutSettled, reportNewVisibleCell, reportRevealPhase, visibleItems]);

  useEffect(() => {
    const trace = revealTrace.current;
    if (!trace || visibleItems[0]?.id === trace.previousFirstId) return;
    reportRevealPhase('react-visible-items-committed', {
      visibleCount: visibleItems.length,
      firstVisibleItemId: visibleItems[0]?.id,
    });
  }, [reportRevealPhase, visibleItems]);

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
      need-visible-item-info={true}
      layout-id={visibleItems.length}
      upper-threshold-item-count={PREFETCH_BUFFER_ITEMS}
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
