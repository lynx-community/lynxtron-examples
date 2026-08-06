import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from '@lynx-js/react';
import type { TimelineEntry } from '../../../shared/agent';
import {
  INITIAL_TIMELINE_ITEM_COUNT,
  HISTORY_LOADER_MIN_VISIBLE_MS,
  latestTimelineWindow,
  normalizeTimelineWindow,
  rebaseTimelineWindowAfterPrepend,
  revealCountForRemotePage,
  shiftTimelineWindowEarlier,
  shiftTimelineWindowLater,
  TimelineHeightCache,
  timelineWindowSize,
  TIMELINE_MAX_MOUNTED_ITEMS,
  TIMELINE_PREFETCH_BUFFER_ITEMS,
  TIMELINE_REMOTE_PAGE_ITEMS,
  estimateTimelineItemHeight,
} from '../../timeline-window';
import {
  BidirectionalList,
  type BidirectionalListController,
  type ListSignalEvent,
} from '../bidirectional-list';
import { Button, LoadingSpinner } from '../ui';
import { decideChatListSignal, shouldShowTailActivity } from './signals';
import './ChatList.css';

export interface ChatListHandle {
  scrollToIndex: (index: number, smooth?: boolean) => void;
  scrollToItem: (itemKey: string, smooth?: boolean) => void;
  scrollToTail: (smooth?: boolean) => void;
}

interface ChatListProps {
  id: string;
  items: TimelineEntry[];
  renderItem: (item: TimelineEntry) => any;
  footer?: any;
  bounces?: boolean;
  hasEarlier?: boolean;
  loadingEarlier?: boolean;
  agentResponding?: boolean;
  onReachStart?: (traceId?: string, limit?: number) => Promise<number | void> | number | void;
  onEarlierLayoutSettled?: () => void;
  onRevealPerformance?: (metrics: Record<string, unknown>) => void;
  onDiagnostic?: (record: Record<string, unknown>) => void;
}

type ChatListRow =
  | { kind: 'spacer'; key: '__chat-list-spacer'; height: number }
  | { kind: 'message'; key: string; item: TimelineEntry }
  | { kind: 'footer'; key: '__chat-list-footer' };

const LIST_VERTICAL_PADDING = 56;
const DEFAULT_FOOTER_ESTIMATE = 120;
const SIGNAL_NEAR_THRESHOLD_PX = 240;
const TAIL_THRESHOLD_PX = 48;
const BACKGROUND_FILL_DEBOUNCE_MS = 1_500;
let chatListDiagnosticSequence = 0;

type EarlierRevealMode = 'foreground' | 'background';

function summarizeListSignal(signal: ListSignalEvent): Record<string, unknown> {
  const snapshot = signal.snapshot;
  return {
    type: signal.type,
    cause: signal.type === 'viewport' ? signal.cause : undefined,
    queryReason: signal.type === 'viewport' ? signal.queryReason : undefined,
    edge: signal.type === 'user-reached-edge' || signal.type === 'user-repeated-edge'
      ? signal.edge
      : undefined,
    gestureId: signal.type === 'user-reached-edge' || signal.type === 'user-repeated-edge'
      ? signal.gestureId
      : snapshot.userGestureId,
    revision: snapshot.revision,
    motion: snapshot.motion,
    start: snapshot.start,
    end: snapshot.end,
    firstCellIndex: snapshot.firstCellIndex,
    lastCellIndex: snapshot.lastCellIndex,
    cellCount: snapshot.cellCount,
    pendingFollow: snapshot.pendingFollow,
  };
}

function logChatListFlow(
  id: string,
  event: string,
  details: Record<string, unknown>,
): Record<string, unknown> {
  const record = {
    sequence: ++chatListDiagnosticSequence,
    timestamp: Date.now(),
    id,
    event,
    ...details,
  };
  console.info('[Codex Demo][chat-list-flow]', JSON.stringify(record));
  return record;
}

function messageRowKey(itemKey: string): string {
  return `message:${itemKey}`;
}

function rowsEqual(left: readonly ChatListRow[], right: readonly ChatListRow[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((row, index) => {
    const candidate = right[index];
    if (!candidate || row.kind !== candidate.kind || row.key !== candidate.key) return false;
    if (row.kind === 'message' && candidate.kind === 'message') return row.item === candidate.item;
    if (row.kind === 'spacer' && candidate.kind === 'spacer') return row.height === candidate.height;
    return true;
  });
}

function tailContentVersion(items: TimelineEntry[]): string {
  const item = items.at(-1);
  if (!item) return '';
  return [
    item.id,
    item.sequence,
    item.kind,
    item.text?.length ?? 0,
    item.tool?.status ?? '',
    item.tool?.text?.length ?? 0,
    item.plan?.map((entry) => `${entry.status ?? ''}:${entry.content.length}`).join(',') ?? '',
  ].join('|');
}

function rowKey(row: ChatListRow): string {
  return row.key;
}

export const ChatList = forwardRef<ChatListHandle, ChatListProps>(function ChatList({
  id,
  items,
  renderItem,
  footer,
  bounces = false,
  hasEarlier = false,
  loadingEarlier = false,
  agentResponding = false,
  onReachStart,
  onEarlierLayoutSettled,
  onRevealPerformance,
  onDiagnostic,
}, ref) {
  const listRef = useRef<BidirectionalListController<ChatListRow> | null>(null);
  const previousItems = useRef({ length: items.length, firstId: items[0]?.id });
  const previousTailVersion = useRef(tailContentVersion(items));
  const followingTail = useRef(true);
  const revealBusy = useRef(false);
  const remoteRequestInFlight = useRef(false);
  const remoteAwaitingLayout = useRef(false);
  const remoteTraceId = useRef<string | null>(null);
  const forceEndOnNextSync = useRef(false);
  const syncRunning = useRef(false);
  const desiredRows = useRef<readonly ChatListRow[]>([]);
  const pendingNavigation = useRef<
    | { type: 'key'; key: string; smooth: boolean }
    | { type: 'tail'; smooth: boolean }
    | null
  >(null);
  const tailFollowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaderShownAt = useRef(0);
  const backgroundFillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyExhausted = useRef(false);
  const revealEarlierRef = useRef<((allowRemote: boolean, mode: EarlierRevealMode) => void) | null>(null);
  const scheduleBackgroundFillRef = useRef<(() => void) | null>(null);
  const measuredHeights = useRef(new TimelineHeightCache());
  const [windowRange, setWindowRange] = useState(() => latestTimelineWindow(items.length));
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measurementRevision, setMeasurementRevision] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [newerContentAvailable, setNewerContentAvailable] = useState(false);
  const [requestingEarlier, setRequestingEarlier] = useState(false);
  const [revealingEarlier, setRevealingEarlier] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [isFollowingTail, setIsFollowingTail] = useState(true);

  const visibleItems = useMemo(
    () => items.slice(windowRange.start, windowRange.end),
    [items, windowRange],
  );
  const windowAtTail = windowRange.end >= items.length;
  const showFooter = Boolean(footer) && windowAtTail;
  const measuredContentHeight = useMemo(
    () => measuredHeights.current.sum(visibleItems),
    [measurementRevision, visibleItems],
  );
  const estimatedFooterHeight = showFooter
    ? Math.max(1, footerHeight || DEFAULT_FOOTER_ESTIMATE)
    : 0;
  const topSpacerHeight = windowRange.start === 0 && windowAtTail && viewportHeight > 0
    ? Math.max(0, viewportHeight - LIST_VERTICAL_PADDING - measuredContentHeight - estimatedFooterHeight)
    : 0;
  const rows = useMemo<ChatListRow[]>(() => [
    ...(topSpacerHeight > 0
      ? [{ kind: 'spacer' as const, key: '__chat-list-spacer' as const, height: topSpacerHeight }]
      : []),
    ...visibleItems.map((item) => ({
      kind: 'message' as const,
      key: messageRowKey(item.id),
      item,
    })),
    ...(showFooter ? [{ kind: 'footer' as const, key: '__chat-list-footer' as const }] : []),
  ], [showFooter, topSpacerHeight, visibleItems]);
  desiredRows.current = rows;
  const initialRows = useRef<readonly ChatListRow[]>(rows);
  const appliedRows = useRef<readonly ChatListRow[]>(initialRows.current);

  const flowState = useCallback(() => ({
    itemsCount: items.length,
    windowStart: windowRange.start,
    windowEnd: windowRange.end,
    windowSize: timelineWindowSize(windowRange),
    windowAtTail,
    desiredRows: desiredRows.current.length,
    appliedRows: appliedRows.current.length,
    revealBusy: revealBusy.current,
    syncRunning: syncRunning.current,
    loadingEarlier,
    requestingEarlier,
    hasEarlier,
    remoteRequestInFlight: remoteRequestInFlight.current,
    remoteAwaitingLayout: remoteAwaitingLayout.current,
    followingTail: followingTail.current,
  }), [hasEarlier, items.length, loadingEarlier, requestingEarlier, windowAtTail, windowRange]);

  const logFlow = useCallback((event: string, details: Record<string, unknown> = {}) => {
    onDiagnostic?.(logChatListFlow(id, event, { ...flowState(), ...details }));
  }, [flowState, id, onDiagnostic]);

  const structuralItemsChange = previousItems.current.length !== items.length
    || previousItems.current.firstId !== items[0]?.id;

  const scheduleTailFollow = useCallback((smooth = false) => {
    if (tailFollowTimer.current) clearTimeout(tailFollowTimer.current);
    tailFollowTimer.current = setTimeout(() => {
      tailFollowTimer.current = null;
      if (followingTail.current) void listRef.current?.scrollToEnd({ smooth });
    }, 32);
  }, []);

  const flushRows = useCallback(async () => {
    if (syncRunning.current || !listRef.current) {
      if (!rowsEqual(appliedRows.current, desiredRows.current)) {
        logFlow('rows-flush-blocked', {
          reason: syncRunning.current ? 'sync-running' : 'list-not-mounted',
        });
      }
      return;
    }
    syncRunning.current = true;
    let shouldRefreshSignals = false;
    let didReplaceRows = false;
    logFlow('rows-flush-start');
    try {
      while (!rowsEqual(appliedRows.current, desiredRows.current)) {
        const target = desiredRows.current;
        const followEnd = forceEndOnNextSync.current;
        forceEndOnNextSync.current = false;
        const replaceStartedAt = Date.now();
        logFlow('rows-replace-start', {
          targetRows: target.length,
          targetFirstKey: target[0]?.key,
          targetLastKey: target.at(-1)?.key,
          position: followEnd ? 'end' : 'preserve',
        });
        const result = await listRef.current.replace(target, {
          position: followEnd ? 'end' : 'preserve',
        });
        logFlow('rows-replace-settled', {
          durationMs: Date.now() - replaceStartedAt,
          transactionId: result.id,
          operation: result.operation,
          outcome: result.outcome,
          reason: result.reason,
          anchorErrorPx: result.anchorErrorPx,
        });
        if (result.outcome !== 'settled') {
          onRevealPerformance?.({
            traceId: `chat-list-sync-${result.id}`,
            phase: 'complete',
            reason: result.reason ?? 'replace-failed',
          });
          break;
        }
        appliedRows.current = target;
        shouldRefreshSignals = true;
        didReplaceRows = true;
      }

      const navigation = pendingNavigation.current;
      pendingNavigation.current = null;
      if (navigation?.type === 'tail') {
        logFlow('navigation-start', navigation);
        await listRef.current.scrollToEnd({ smooth: navigation.smooth });
        logFlow('navigation-complete', navigation);
      } else if (navigation?.type === 'key') {
        logFlow('navigation-start', navigation);
        await listRef.current.scrollToKey(navigation.key, {
          align: 'center',
          smooth: navigation.smooth,
        });
        logFlow('navigation-complete', navigation);
      }

      if (remoteAwaitingLayout.current && didReplaceRows) {
        logFlow('remote-layout-settled', { traceId: remoteTraceId.current });
        remoteAwaitingLayout.current = false;
        onEarlierLayoutSettled?.();
        onRevealPerformance?.({
          traceId: remoteTraceId.current ?? `chat-list-history-${Date.now()}`,
          phase: 'complete',
          mountedCount: desiredRows.current.length,
        });
        remoteTraceId.current = null;
      }
    } finally {
      syncRunning.current = false;
      if (!remoteRequestInFlight.current && !remoteAwaitingLayout.current) revealBusy.current = false;
      const needsAnotherFlush = !rowsEqual(appliedRows.current, desiredRows.current);
      logFlow('rows-flush-complete', { needsAnotherFlush });
      if (needsAnotherFlush) void flushRows();
      else if (shouldRefreshSignals) {
        setRevealingEarlier(false);
        void listRef.current?.refreshSignals('content-settled');
      }
    }
  }, [logFlow, onEarlierLayoutSettled, onRevealPerformance]);

  const revealEarlier = useCallback((
    allowRemote = false,
    mode: EarlierRevealMode = 'foreground',
  ) => {
    logFlow('reveal-earlier-attempt', { allowRemote, mode });
    if (mode === 'background' && timelineWindowSize(windowRange) >= TIMELINE_MAX_MOUNTED_ITEMS) {
      setRevealingEarlier(false);
      logFlow('reveal-earlier-noop', { allowRemote, mode, reason: 'background-window-full' });
      return;
    }
    if (revealBusy.current || loadingEarlier || remoteRequestInFlight.current) {
      logFlow('reveal-earlier-blocked', {
        allowRemote,
        mode,
        reason: revealBusy.current
          ? 'reveal-busy'
          : loadingEarlier
            ? 'loading-earlier-prop'
            : 'remote-request-in-flight',
      });
      if (mode === 'background') scheduleBackgroundFillRef.current?.();
      return;
    }
    if (windowRange.start > 0) {
      revealBusy.current = true;
      setRevealingEarlier(true);
      setWindowRange((current) => {
        const next = shiftTimelineWindowEarlier(
          current,
          TIMELINE_PREFETCH_BUFFER_ITEMS,
          items.length,
        );
        logFlow('reveal-earlier-local-requested', {
          allowRemote,
          mode,
          previousWindow: current,
          nextWindow: next,
        });
        return next;
      });
      return;
    }
    if (!allowRemote || !hasEarlier || !onReachStart) {
      setRevealingEarlier(false);
      if (allowRemote && !hasEarlier) historyExhausted.current = true;
      logFlow('reveal-earlier-noop', {
        allowRemote,
        mode,
        reason: !allowRemote
          ? 'remote-not-allowed'
          : !hasEarlier
            ? 'no-earlier-data'
            : 'missing-on-reach-start',
      });
      return;
    }

    revealBusy.current = true;
    setRevealingEarlier(true);
    remoteRequestInFlight.current = true;
    remoteAwaitingLayout.current = true;
    setRequestingEarlier(true);
    const traceId = `chat-list-history-${Date.now()}`;
    remoteTraceId.current = traceId;
    logFlow('remote-request-dispatched', { traceId, limit: TIMELINE_REMOTE_PAGE_ITEMS });
    onRevealPerformance?.({ traceId, phase: 'history-request-dispatched' });
    Promise.resolve(onReachStart(traceId, TIMELINE_REMOTE_PAGE_ITEMS))
      .then((loadedCount) => {
        logFlow('remote-request-resolved', { traceId, loadedCount });
        if (loadedCount !== 0) {
          historyExhausted.current = false;
          return;
        }
        historyExhausted.current = true;
        setRevealingEarlier(false);
        remoteAwaitingLayout.current = false;
        remoteTraceId.current = null;
        onRevealPerformance?.({ traceId, phase: 'complete', reason: 'empty-page' });
      })
      .catch((error) => {
        historyExhausted.current = true;
        setRevealingEarlier(false);
        logFlow('remote-request-rejected', {
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
        remoteAwaitingLayout.current = false;
        remoteTraceId.current = null;
        onRevealPerformance?.({ traceId, phase: 'complete', reason: 'request-failed' });
      })
      .finally(() => {
        remoteRequestInFlight.current = false;
        if (!remoteAwaitingLayout.current) revealBusy.current = false;
        setRequestingEarlier(false);
        logFlow('remote-request-finalized', { traceId });
      });
  }, [hasEarlier, items.length, loadingEarlier, logFlow, onReachStart, onRevealPerformance, windowRange]);

  revealEarlierRef.current = revealEarlier;

  const cancelBackgroundFill = useCallback((reason: string) => {
    if (!backgroundFillTimer.current) return;
    clearTimeout(backgroundFillTimer.current);
    backgroundFillTimer.current = null;
    logFlow('background-fill-cancelled', { reason });
  }, [logFlow]);

  const scheduleBackgroundFill = useCallback(() => {
    cancelBackgroundFill('reschedule');
    const windowSize = timelineWindowSize(windowRange);
    const canLoadLocal = windowRange.start > 0;
    const canLoadRemote = hasEarlier && Boolean(onReachStart) && !historyExhausted.current;
    if (windowSize >= TIMELINE_MAX_MOUNTED_ITEMS || !canLoadLocal && !canLoadRemote) {
      logFlow('background-fill-not-scheduled', {
        windowSize,
        canLoadLocal,
        canLoadRemote,
        historyExhausted: historyExhausted.current,
      });
      return;
    }
    backgroundFillTimer.current = setTimeout(() => {
      backgroundFillTimer.current = null;
      logFlow('background-fill-fired', { debounceMs: BACKGROUND_FILL_DEBOUNCE_MS });
      revealEarlierRef.current?.(true, 'background');
    }, BACKGROUND_FILL_DEBOUNCE_MS);
    logFlow('background-fill-scheduled', {
      debounceMs: BACKGROUND_FILL_DEBOUNCE_MS,
      windowSize,
    });
  }, [cancelBackgroundFill, hasEarlier, logFlow, onReachStart, windowRange]);

  scheduleBackgroundFillRef.current = scheduleBackgroundFill;

  const revealLater = useCallback(() => {
    logFlow('reveal-later-attempt');
    if (revealBusy.current || windowAtTail) {
      logFlow('reveal-later-blocked', {
        reason: revealBusy.current ? 'reveal-busy' : 'window-at-tail',
      });
      return;
    }
    revealBusy.current = true;
    setWindowRange((current) => {
      const next = shiftTimelineWindowLater(
        current,
        TIMELINE_PREFETCH_BUFFER_ITEMS,
        items.length,
      );
      logFlow('reveal-later-local-requested', {
        previousWindow: current,
        nextWindow: next,
      });
      return next;
    });
  }, [items.length, logFlow, windowAtTail]);

  const handleListSignal = useCallback((signal: ListSignalEvent) => {
    const decision = decideChatListSignal(signal, TAIL_THRESHOLD_PX);
    logFlow('list-signal-received', {
      signal: summarizeListSignal(signal),
      decision,
    });
    if (decision.followingTail !== undefined) {
      followingTail.current = decision.followingTail;
      if (decision.followingTail) setNewerContentAvailable(false);
      setIsFollowingTail(decision.followingTail);
    }
    if (decision.earlier !== 'none') {
      cancelBackgroundFill('immediate-near-or-edge');
      revealEarlier(decision.earlier === 'allow-remote', 'foreground');
    } else if (decision.backgroundEarlier) {
      scheduleBackgroundFill();
    }
    if (decision.later) revealLater();
  }, [cancelBackgroundFill, logFlow, revealEarlier, revealLater, scheduleBackgroundFill]);

  const handleOuterLayout = useCallback((event: any) => {
    const detail = event?.detail ?? event;
    const layout = detail?.layout ?? detail;
    if (typeof layout?.height === 'number' && layout.height > 0) {
      if (followingTail.current) forceEndOnNextSync.current = true;
      setViewportHeight(layout.height);
    }
  }, []);

  const handleMessageLayout = useCallback((itemKey: string, event: any) => {
    const detail = event?.detail ?? event;
    const layout = detail?.layout ?? detail;
    if (typeof layout?.height !== 'number' || layout.height < 0) return;
    if (measuredHeights.current.set(itemKey, layout.height)) {
      if (windowAtTail && followingTail.current) forceEndOnNextSync.current = true;
      setMeasurementRevision((current) => current + 1);
    }
    if (windowAtTail && items.at(-1)?.id === itemKey && followingTail.current) {
      scheduleTailFollow(false);
    }
  }, [items, scheduleTailFollow, windowAtTail]);

  const handleFooterLayout = useCallback((event: any) => {
    const detail = event?.detail ?? event;
    const layout = detail?.layout ?? detail;
    if (typeof layout?.height !== 'number' || layout.height < 0) return;
    if (followingTail.current) forceEndOnNextSync.current = true;
    setFooterHeight(layout.height);
    if (followingTail.current) scheduleTailFollow(false);
  }, [scheduleTailFollow]);

  useEffect(() => {
    const previous = previousItems.current;
    previousItems.current = { length: items.length, firstId: items[0]?.id };

    logFlow('items-observed', {
      previousCount: previous.length,
      nextCount: items.length,
      previousFirstId: previous.firstId,
      nextFirstId: items[0]?.id,
    });

    if (items.length < previous.length || previous.length === 0 && items.length > 0) {
      cancelBackgroundFill('items-reset');
      historyExhausted.current = !hasEarlier;
      forceEndOnNextSync.current = true;
      followingTail.current = true;
      setIsFollowingTail(true);
      setNewerContentAvailable(false);
      setRevealingEarlier(false);
      logFlow('items-reset-to-latest');
      setWindowRange(latestTimelineWindow(items.length));
      return;
    }
    if (items.length > previous.length && items[0]?.id === previous.firstId) {
      const addedCount = items.length - previous.length;
      if (followingTail.current) {
        forceEndOnNextSync.current = true;
        logFlow('items-appended-follow-tail', { addedCount });
        setWindowRange((current) => shiftTimelineWindowLater(current, addedCount, items.length));
      } else {
        logFlow('items-appended-away-from-tail', { addedCount });
        setNewerContentAvailable(true);
      }
      return;
    }
    if (items.length > previous.length && items[0]?.id !== previous.firstId) {
      historyExhausted.current = false;
      const addedCount = items.length - previous.length;
      const revealCount = revealCountForRemotePage(addedCount, TIMELINE_PREFETCH_BUFFER_ITEMS);
      logFlow('items-prepended', { addedCount, revealCount });
      setWindowRange((current) => rebaseTimelineWindowAfterPrepend(
        current,
        addedCount,
        revealCount,
        items.length,
      ));
      return;
    }
    if (items.length === previous.length && items[0]?.id !== previous.firstId) {
      cancelBackgroundFill('items-identity-reset');
      historyExhausted.current = !hasEarlier;
      forceEndOnNextSync.current = true;
      followingTail.current = true;
      setIsFollowingTail(true);
      setNewerContentAvailable(false);
      setRevealingEarlier(false);
      logFlow('items-identity-reset');
      setWindowRange(latestTimelineWindow(items.length));
    }
  }, [cancelBackgroundFill, hasEarlier, items, logFlow]);

  const latestTailVersion = tailContentVersion(items);
  useEffect(() => {
    const previous = previousTailVersion.current;
    previousTailVersion.current = latestTailVersion;
    if (!previous || previous === latestTailVersion) return;
    if (!followingTail.current) {
      setNewerContentAvailable(true);
      return;
    }
    forceEndOnNextSync.current = true;
    if (!windowAtTail) {
      setWindowRange((current) => latestTimelineWindow(
        items.length,
        Math.min(TIMELINE_MAX_MOUNTED_ITEMS, Math.max(
          INITIAL_TIMELINE_ITEM_COUNT,
          timelineWindowSize(current),
        )),
      ));
    }
  }, [items.length, latestTailVersion, windowAtTail]);

  useEffect(() => {
    if (structuralItemsChange) {
      logFlow('rows-flush-deferred', { reason: 'structural-items-change' });
      return;
    }
    void flushRows();
  }, [flushRows, logFlow, rows, structuralItemsChange]);

  useEffect(() => {
    logFlow('window-rendered', {
      firstVisibleItemId: visibleItems[0]?.id,
      lastVisibleItemId: visibleItems.at(-1)?.id,
    });
  }, [logFlow, visibleItems]);

  useEffect(() => () => {
    if (tailFollowTimer.current) clearTimeout(tailFollowTimer.current);
    if (loaderHideTimer.current) clearTimeout(loaderHideTimer.current);
    if (backgroundFillTimer.current) clearTimeout(backgroundFillTimer.current);
  }, []);

  useEffect(() => {
    historyExhausted.current = !hasEarlier;
    if (!hasEarlier && windowRange.start === 0) cancelBackgroundFill('history-exhausted');
  }, [cancelBackgroundFill, hasEarlier, id, windowRange.start]);

  const loadingActive = loadingEarlier || requestingEarlier || revealingEarlier;
  useEffect(() => {
    if (loadingActive) {
      if (loaderHideTimer.current) {
        clearTimeout(loaderHideTimer.current);
        loaderHideTimer.current = null;
      }
      if (!loaderVisible) {
        loaderShownAt.current = Date.now();
        setLoaderVisible(true);
      }
      return;
    }
    if (!loaderVisible || loaderHideTimer.current) return;
    const remaining = Math.max(
      0,
      HISTORY_LOADER_MIN_VISIBLE_MS - (Date.now() - loaderShownAt.current),
    );
    loaderHideTimer.current = setTimeout(() => {
      loaderHideTimer.current = null;
      setLoaderVisible(false);
    }, remaining);
  }, [loaderVisible, loadingActive]);

  const jumpToTail = useCallback((smooth = false) => {
    followingTail.current = true;
    setIsFollowingTail(true);
    setNewerContentAvailable(false);
    forceEndOnNextSync.current = true;
    if (windowAtTail) {
      void listRef.current?.scrollToEnd({ smooth });
      return;
    }
    pendingNavigation.current = { type: 'tail', smooth };
    setWindowRange((current) => latestTimelineWindow(
      items.length,
      Math.min(TIMELINE_MAX_MOUNTED_ITEMS, Math.max(
        INITIAL_TIMELINE_ITEM_COUNT,
        timelineWindowSize(current),
      )),
    ));
  }, [items.length, windowAtTail]);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, smooth = false) => {
      if (items.length === 0) return;
      const targetIndex = Math.max(0, Math.min(items.length - 1, Math.floor(index)));
      const target = items[targetIndex];
      if (!target) return;
      if (targetIndex >= windowRange.start && targetIndex < windowRange.end) {
        void listRef.current?.scrollToKey(messageRowKey(target.id), { align: 'center', smooth });
        return;
      }
      const half = Math.floor(TIMELINE_MAX_MOUNTED_ITEMS / 2);
      const end = Math.min(items.length, Math.max(TIMELINE_MAX_MOUNTED_ITEMS, targetIndex + half));
      const start = Math.max(0, Math.min(targetIndex, end - TIMELINE_MAX_MOUNTED_ITEMS));
      pendingNavigation.current = { type: 'key', key: messageRowKey(target.id), smooth };
      setWindowRange(normalizeTimelineWindow({ start, end }, items.length));
    },
    scrollToItem: (itemKey, smooth = false) => {
      const index = items.findIndex((item) => item.id === itemKey);
      if (index < 0) return;
      if (index >= windowRange.start && index < windowRange.end) {
        void listRef.current?.scrollToKey(messageRowKey(itemKey), { align: 'center', smooth });
        return;
      }
      const half = Math.floor(TIMELINE_MAX_MOUNTED_ITEMS / 2);
      const end = Math.min(items.length, Math.max(TIMELINE_MAX_MOUNTED_ITEMS, index + half));
      const start = Math.max(0, Math.min(index, end - TIMELINE_MAX_MOUNTED_ITEMS));
      pendingNavigation.current = { type: 'key', key: messageRowKey(itemKey), smooth };
      setWindowRange(normalizeTimelineWindow({ start, end }, items.length));
    },
    scrollToTail: (smooth = false) => {
      jumpToTail(smooth);
    },
  }), [items, jumpToTail, windowRange]);

  const renderRow = useCallback((row: ChatListRow) => {
    if (row.kind === 'spacer') {
      return <view className="chat-list-spacer" style={{ height: `${row.height}px` }} />;
    }
    if (row.kind === 'footer') {
      return (
        <view className="chat-list-footer" bindlayoutchange={handleFooterLayout}>
          <view className="chat-list-item-content">{footer}</view>
        </view>
      );
    }
    return (
      <view
        className="chat-list-message"
        bindlayoutchange={(event) => handleMessageLayout(row.item.id, event)}
      >
        <view className="chat-list-item-content">{renderItem(row.item)}</view>
      </view>
    );
  }, [footer, handleFooterLayout, handleMessageLayout, renderItem]);

  const tailActivityVisible = shouldShowTailActivity({
    followingTail: isFollowingTail,
    agentResponding,
    newerContentAvailable,
  });
  return (
    <view className="chat-list-shell" bindlayoutchange={handleOuterLayout}>
      <BidirectionalList
        ref={listRef}
        id={id}
        initialItems={initialRows.current}
        getItemKey={rowKey}
        renderItem={renderRow}
        estimateItemSize={(row) => row.kind === 'spacer'
          ? row.height
          : row.kind === 'footer'
            ? Math.max(1, footerHeight || DEFAULT_FOOTER_ESTIMATE)
            : estimateTimelineItemHeight(row.item)}
        initialPosition="end"
        bounces={bounces}
        signalNearThresholdPx={SIGNAL_NEAR_THRESHOLD_PX}
        diagnostics={{ onFlow: onDiagnostic }}
        onListSignal={handleListSignal}
      />
      <view className={`chat-list-loader ${loaderVisible ? 'chat-list-loader--visible' : ''}`}>
        <view className="chat-list-loader-content">
          <LoadingSpinner size="small" label="Loading earlier messages…" />
        </view>
      </view>
      {tailActivityVisible ? (
        <Button
          className="chat-list-newer"
          variant="ghost"
          onTap={() => jumpToTail(false)}
        >
          <view className="chat-list-newer-dot chat-list-newer-dot--1" />
          <view className="chat-list-newer-dot chat-list-newer-dot--2" />
          <view className="chat-list-newer-dot chat-list-newer-dot--3" />
        </Button>
      ) : null}
    </view>
  );
});
