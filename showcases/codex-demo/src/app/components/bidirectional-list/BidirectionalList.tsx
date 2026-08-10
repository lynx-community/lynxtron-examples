import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from '@lynx-js/react';
import type {
  ListLayoutCompleteEvent,
  ListScrollEvent,
  ListScrollStateChangeEvent,
  ListScrollToLowerEvent,
  ListScrollToUpperEvent,
} from '@lynx-js/types';
import { BidirectionalListEngine } from './engine';
import { LynxListDriver } from './LynxListDriver';
import {
  NativeListSignalNormalizer,
  parseNativeListSignal,
  type NativeListEventMap,
} from './native-signals';
import { ListSignalMachine } from './signal-machine';
import {
  computeEdgeSnapshot,
  EdgeEpisodeTracker,
} from './model';
import type {
  BidirectionalListController,
  BidirectionalListProps,
  EdgeSnapshot,
  ListCellMeasurement,
  ListMutationKind,
  ListSignalQueryReason,
  NativeListSignalType,
  NormalizedNativeListSignal,
  PositionReconciler,
  PositionVerificationRequest,
  ListSnapshot,
  ListSignalSnapshot,
  ListTransactionResult,
} from './types';
import './BidirectionalList.css';

const LAYOUT_COMPLETION_FALLBACK_MS = 160;
const EDGE_DIAGNOSTIC_RANGE_PX = 640;
const NATIVE_DIAGNOSTIC_MIN_INTERVAL_MS = 80;
const QUERY_SETTLE_INTERVAL_MS = 16;
const QUERY_MAX_SAMPLES = 4;
const QUERY_STABLE_TOLERANCE_PX = 0.75;
const POSITION_MATCH_TOLERANCE_PX = 1;
const RECOVERY_LAYOUT_TIMEOUT_MS = 1_200;
const EVENT_SOURCE_LAYOUT = 1;
const SCROLL_STATE_STOP = 1;
const SCROLL_STATE_DRAGGING = 2;
let listDiagnosticSequence = 0;

interface ActiveGeometrySample {
  scroll: Awaited<ReturnType<LynxListDriver['getScrollInfo']>>;
  cells: readonly ListCellMeasurement[];
}

function geometrySamplesStable(left: ActiveGeometrySample, right: ActiveGeometrySample): boolean {
  const close = (a: number, b: number) => Math.abs(a - b) <= QUERY_STABLE_TOLERANCE_PX;
  if (!close(left.scroll.scrollTop, right.scroll.scrollTop)
    || !close(left.scroll.maxScroll, right.scroll.maxScroll)
    || !close(left.scroll.listHeight, right.scroll.listHeight)
    || left.cells.length !== right.cells.length) return false;
  return left.cells.every((cell, index) => {
    const candidate = right.cells[index];
    return candidate?.key === cell.key
      && candidate.index === cell.index
      && close(candidate.top, cell.top)
      && close(candidate.bottom, cell.bottom);
  });
}

function logListFlow(id: string, event: string, details: Record<string, unknown>): Record<string, unknown> {
  const record = {
    sequence: ++listDiagnosticSequence,
    timestamp: Date.now(),
    id,
    event,
    ...details,
  };
  console.info('[Codex Demo][list-flow]', JSON.stringify(record));
  return record;
}

function reasonForMutation(operation: ListMutationKind): 'insert' | 'navigation' | 'content-resize' {
  if (operation === 'prepend' || operation === 'append') return 'insert';
  if (operation === 'navigate') return 'navigation';
  return 'content-resize';
}

function nativeCells(result: any): any[] {
  const detail = result?.detail ?? result;
  const cellsContainer = detail?.scrollInfo ?? detail;
  if (Array.isArray(cellsContainer)) return cellsContainer;
  if (Array.isArray(cellsContainer?.cells)) return cellsContainer.cells;
  if (Array.isArray(cellsContainer?.visibleCells)) return cellsContainer.visibleCells;
  if (Array.isArray(cellsContainer?.attachedCells)) return cellsContainer.attachedCells;
  return [];
}

function nativeScrollMetrics(detail: any): {
  scrollTop: number;
  scrollHeight: number;
  listHeight: number;
} | undefined {
  if (
    typeof detail?.scrollTop !== 'number'
    || typeof detail?.scrollHeight !== 'number'
    || typeof detail?.listHeight !== 'number'
  ) return undefined;
  return {
    scrollTop: detail.scrollTop,
    scrollHeight: detail.scrollHeight,
    listHeight: detail.listHeight,
  };
}

function BidirectionalListInner<T>(
  {
    id,
    initialItems,
    getItemKey,
    renderItem,
    initialPosition = 'end',
    bounces = true,
    edgeThreshold,
    signalNearThresholdPx,
    onEdgeStateChange,
    onStartReached,
    onEndReached,
    onWindowChange,
    onTransactionSettled,
    diagnostics,
    onListSignal,
  }: BidirectionalListProps<T>,
  ref: any,
) {
  const [items, setItems] = useState<readonly T[]>(() => [...initialItems]);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [nativeListGeneration, setNativeListGeneration] = useState(0);
  const nativeListGenerationRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const itemsRef = useRef(items);
  const mountedKeysRef = useRef<readonly string[]>([]);
  const viewportHeightRef = useRef(viewportHeight);
  const dataRevisionRef = useRef(0);
  const pendingLayoutTransactionRef = useRef<number | null>(null);
  const layoutCompletionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPositioningRef = useRef<'pending' | 'running' | 'done'>('pending');
  const edgeTrackerRef = useRef(new EdgeEpisodeTracker());
  const nativeSignalNormalizerRef = useRef(new NativeListSignalNormalizer());
  const signalMachineRef = useRef(new ListSignalMachine({
    nearThresholdPx: signalNearThresholdPx,
  }));
  const lastEdgeSnapshotRef = useRef<EdgeSnapshot | null>(null);
  const lastEdgeSignatureRef = useRef('');
  const lastNativeDiagnosticRef = useRef({ signature: '', timestamp: 0 });
  const lastStableDiagnosticSignatureRef = useRef('');
  const queryGenerationRef = useRef(0);
  const gestureQueryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconcileViewportRef = useRef<(
    reason: ListSignalQueryReason,
  ) => Promise<ActiveGeometrySample | undefined>>(async () => undefined);
  const remountNativeListRef = useRef<(
    request: PositionVerificationRequest,
  ) => Promise<void>>(async () => {});
  const recoveryLayoutWaiterRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const callbacksRef = useRef({
    onEdgeStateChange,
    onStartReached,
    onEndReached,
    onWindowChange,
    onTransactionSettled,
    onNativeSignal: diagnostics?.onNativeSignal,
    onNormalizedNativeSignal: diagnostics?.onNormalizedNativeSignal,
    onFlow: diagnostics?.onFlow,
    onListSignal,
  });
  callbacksRef.current = {
    onEdgeStateChange,
    onStartReached,
    onEndReached,
    onWindowChange,
    onTransactionSettled,
    onNativeSignal: diagnostics?.onNativeSignal,
    onNormalizedNativeSignal: diagnostics?.onNormalizedNativeSignal,
    onFlow: diagnostics?.onFlow,
    onListSignal,
  };

  const emitListFlow = useCallback((event: string, details: Record<string, unknown> = {}) => {
    const record = logListFlow(id, event, details);
    callbacksRef.current.onFlow?.(record);
  }, [id]);

  signalMachineRef.current.setNearThreshold(signalNearThresholdPx);

  mountedKeysRef.current = items.map(getItemKey);
  itemsRef.current = items;
  viewportHeightRef.current = viewportHeight;

  const driverRef = useRef<LynxListDriver | null>(null);
  if (!driverRef.current) {
    driverRef.current = new LynxListDriver({
      getNativeId: () => `${id}--native-${nativeListGenerationRef.current}`,
      getViewportHeight: () => viewportHeightRef.current,
      getMountedKeys: () => mountedKeysRef.current,
    });
  }

  const positionReconcilerRef = useRef<PositionReconciler | null>(null);
  if (!positionReconcilerRef.current) {
    positionReconcilerRef.current = {
      verify: async (request) => {
        const sample = await reconcileViewportRef.current('position-verification');
        if (!sample) return 'unstable';
        if (itemsRef.current.length > 0 && sample.cells.length === 0) return 'detached';
        const target = sample.cells.find((cell) => cell.key === request.targetKey);
        if (!target) return 'mismatched';
        const close = (left: number, right: number) => (
          Math.abs(left - right) <= POSITION_MATCH_TOLERANCE_PX
        );
        const distanceToEnd = Math.max(0, sample.scroll.maxScroll - sample.scroll.scrollTop);
        const isFirst = request.targetIndex === 0;
        const isLast = request.targetIndex === itemsRef.current.length - 1;
        const aligned = request.align === 'start'
          ? close(target.top, request.expectedTop)
          : request.align === 'end'
            ? close(target.bottom, sample.scroll.listHeight)
            : close((target.top + target.bottom) / 2, sample.scroll.listHeight / 2);
        const clampedBoundaryMatch = request.align === 'start'
          ? isFirst && sample.scroll.scrollTop <= POSITION_MATCH_TOLERANCE_PX
          : request.align === 'end'
            ? isLast && distanceToEnd <= POSITION_MATCH_TOLERANCE_PX
            : (isFirst && sample.scroll.scrollTop <= POSITION_MATCH_TOLERANCE_PX)
              || (isLast && distanceToEnd <= POSITION_MATCH_TOLERANCE_PX);
        return aligned || clampedBoundaryMatch ? 'matched' : 'mismatched';
      },
      recover: (request) => remountNativeListRef.current(request),
    };
  }

  const engineRef = useRef<BidirectionalListEngine<T> | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BidirectionalListEngine<T>({
      initialItems,
      getItemKey,
      driver: driverRef.current,
      onCommit: ({ items: nextItems, transactionId }) => {
        emitListFlow('transaction-commit', {
          transactionId,
          previousCount: itemsRef.current.length,
          nextCount: nextItems.length,
        });
        if (layoutCompletionFallbackRef.current) {
          clearTimeout(layoutCompletionFallbackRef.current);
          layoutCompletionFallbackRef.current = null;
        }
        const previousItems = itemsRef.current;
        const mountedContentUnchanged = previousItems.length === nextItems.length
          && previousItems.every((item, index) => item === nextItems[index]);
        itemsRef.current = nextItems;
        pendingLayoutTransactionRef.current = mountedContentUnchanged ? null : transactionId;
        dataRevisionRef.current += 1;
        setItems(nextItems);
        setLayoutRevision((current) => current + 1);
        if (mountedContentUnchanged) {
          emitListFlow('transaction-layout-noop', { transactionId });
          driverRef.current!.notifyLayoutComplete(transactionId);
        } else {
          // PITFALL (observed): Lynx may omit `layoutcomplete` when keyed
          // children change but their geometry does not. Keep this short
          // fallback or a valid no-op layout can stall the mutation queue.
          // This timeout only releases the layout gate; anchor verification
          // still decides whether the transaction really settled.
          layoutCompletionFallbackRef.current = setTimeout(() => {
            layoutCompletionFallbackRef.current = null;
            if (pendingLayoutTransactionRef.current !== transactionId) return;
            pendingLayoutTransactionRef.current = null;
            emitListFlow('transaction-layout-fallback', {
              transactionId,
              fallbackAfterMs: LAYOUT_COMPLETION_FALLBACK_MS,
            });
            driverRef.current!.notifyLayoutComplete(transactionId);
          }, LAYOUT_COMPLETION_FALLBACK_MS);
        }
      },
      onSettled: (result) => {
        emitListFlow('transaction-settled', {
          transactionId: result.id,
          operation: result.operation,
          outcome: result.outcome,
          reason: result.reason,
          anchorErrorPx: result.anchorErrorPx,
        });
        callbacksRef.current.onTransactionSettled?.(result);
      },
      appendFollowSettlement: signalMachineRef.current,
      positionReconciler: positionReconcilerRef.current,
    });
  }

  const snapshotFrom = useCallback((edge: EdgeSnapshot): ListSnapshot<T> => {
    const machine = engineRef.current!.getMachineState();
    const visibleStart = edge.firstVisibleIndex >= 0 ? edge.firstVisibleIndex : 0;
    const visibleEnd = edge.lastVisibleIndex >= 0 ? edge.lastVisibleIndex + 1 : visibleStart;
    return {
      ...edge,
      items: itemsRef.current,
      visibleRange: { start: visibleStart, end: visibleEnd },
      transaction: machine.active
        ? { status: machine.phase as Exclude<typeof machine.phase, 'idle'>, id: machine.active.transactionId, operation: machine.active.operation }
        : { status: 'idle' },
    };
  }, []);

  const publishGeometry = useCallback((
    localCells: readonly ListCellMeasurement[],
    reason: Parameters<EdgeEpisodeTracker['observe']>[1],
    scrollMetrics?: ReturnType<typeof nativeScrollMetrics>,
  ) => {
    const viewportEnd = viewportHeightRef.current;
    const absoluteCells = localCells
      .filter((cell) => cell.bottom >= 0 && cell.top <= viewportEnd);
    // PITFALL (observed): during an imperative scroll, Lynx can briefly report
    // neither attached cells nor scroll metrics for a non-empty list. Treating
    // that sample as real would flash a false empty/edge state, so retain the
    // last valid geometry until a complete sample arrives.
    if (itemsRef.current.length > 0 && absoluteCells.length === 0 && !scrollMetrics) return;
    const edge = computeEdgeSnapshot({
      totalItems: itemsRef.current.length,
      cells: absoluteCells,
      viewport: { start: 0, end: viewportHeightRef.current },
      scrollMetrics,
      threshold: edgeThreshold,
    });
    lastEdgeSnapshotRef.current = edge;
    const signature = JSON.stringify(edge);
    if (signature !== lastEdgeSignatureRef.current) {
      lastEdgeSignatureRef.current = signature;
      callbacksRef.current.onEdgeStateChange?.(edge);
      callbacksRef.current.onWindowChange?.(snapshotFrom(edge));
    }
    for (const event of edgeTrackerRef.current.observe(edge, reason, dataRevisionRef.current)) {
      if (event.edge === 'start') callbacksRef.current.onStartReached?.(event);
      else callbacksRef.current.onEndReached?.(event);
    }
  }, [edgeThreshold, snapshotFrom]);

  const geometryReason = useCallback((fallback: Parameters<EdgeEpisodeTracker['observe']>[1]) => {
    const active = engineRef.current?.getMachineState().active;
    return active ? reasonForMutation(active.operation) : fallback;
  }, []);

  const publishNormalizedSignal = useCallback((normalized: NormalizedNativeListSignal) => {
    callbacksRef.current.onNormalizedNativeSignal?.(normalized);
    for (const listSignal of signalMachineRef.current.observe(normalized)) {
      const snapshot = listSignal.snapshot;
      const stableSignature = JSON.stringify({
        type: listSignal.type,
        cause: listSignal.type === 'viewport' ? listSignal.cause : undefined,
        queryReason: listSignal.type === 'viewport' ? listSignal.queryReason : undefined,
        edge: listSignal.type === 'user-reached-edge' || listSignal.type === 'user-repeated-edge'
          ? listSignal.edge
          : undefined,
        gestureId: snapshot.userGestureId,
        motion: snapshot.motion,
        startAt: snapshot.start.at,
        startNear: snapshot.start.near,
        startDistanceBucket: snapshot.start.distancePx === undefined
          ? undefined
          : Math.round(snapshot.start.distancePx / 50) * 50,
        endAt: snapshot.end.at,
        endNear: snapshot.end.near,
        endDistanceBucket: snapshot.end.distancePx === undefined
          ? undefined
          : Math.round(snapshot.end.distancePx / 50) * 50,
        firstCellIndex: snapshot.firstCellIndex,
        lastCellIndex: snapshot.lastCellIndex,
        pendingFollow: snapshot.pendingFollow,
      });
      if (stableSignature !== lastStableDiagnosticSignatureRef.current) {
        lastStableDiagnosticSignatureRef.current = stableSignature;
        emitListFlow('stable-signal-emitted', {
          signalType: listSignal.type,
          cause: listSignal.type === 'viewport' ? listSignal.cause : undefined,
          queryReason: listSignal.type === 'viewport' ? listSignal.queryReason : undefined,
          edge: listSignal.type === 'user-reached-edge' || listSignal.type === 'user-repeated-edge'
            ? listSignal.edge
            : undefined,
          revision: snapshot.revision,
          userGestureId: snapshot.userGestureId,
          motion: snapshot.motion,
          start: snapshot.start,
          end: snapshot.end,
          firstCellIndex: snapshot.firstCellIndex,
          lastCellIndex: snapshot.lastCellIndex,
          cellCount: snapshot.cellCount,
          pendingFollow: snapshot.pendingFollow,
        });
      }
      callbacksRef.current.onListSignal?.(listSignal);
    }
  }, [emitListFlow]);

  const reconcileViewport = useCallback(async (
    reason: ListSignalQueryReason = 'manual',
  ): Promise<ActiveGeometrySample | undefined> => {
    const generation = ++queryGenerationRef.current;
    const startedAt = Date.now();
    let previous: ActiveGeometrySample | undefined;
    let accepted: ActiveGeometrySample | undefined;
    let sampleCount = 0;
    emitListFlow('query-signal-start', { generation, reason });
    try {
      // PITFALL (observed): one `getScrollInfo` immediately after a mutation can
      // describe an intermediate layout. Require two stable samples when
      // possible. This is reconciliation, not a substitute for native events.
      for (let attempt = 0; attempt < QUERY_MAX_SAMPLES; attempt += 1) {
        const [scroll, cells] = await Promise.all([
          driverRef.current!.getScrollInfo(),
          driverRef.current!.getVisibleCells(),
        ]);
        if (generation !== queryGenerationRef.current) return;
        const current = { scroll, cells };
        sampleCount += 1;
        if (previous && geometrySamplesStable(previous, current)) {
          accepted = current;
          break;
        }
        previous = current;
        if (attempt < QUERY_MAX_SAMPLES - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, QUERY_SETTLE_INTERVAL_MS));
          if (generation !== queryGenerationRef.current) return;
        }
      }

      if (!accepted || generation !== queryGenerationRef.current) {
        emitListFlow('query-signal-complete', {
          generation,
          reason,
          durationMs: Date.now() - startedAt,
          sampleCount,
          stable: false,
        });
        return undefined;
      }
      const sample = accepted;
      const scrollTop = Math.max(0, Math.min(sample.scroll.scrollTop, sample.scroll.maxScroll));
      const distanceToEnd = Math.max(0, sample.scroll.maxScroll - scrollTop);
      const normalized: NormalizedNativeListSignal = {
        type: 'geometry',
        trigger: 'query',
        queryReason: reason,
        eventSource: EVENT_SOURCE_LAYOUT,
        geometry: {
          scrollTop,
          scrollHeight: sample.scroll.scrollHeight,
          listHeight: sample.scroll.listHeight,
          maxScroll: sample.scroll.maxScroll,
          distanceToStart: scrollTop,
          distanceToEnd,
          atStart: scrollTop <= 0.5,
          atEnd: distanceToEnd <= 0.5,
        },
        firstCellIndex: sample.cells[0]?.index,
        lastCellIndex: sample.cells.at(-1)?.index,
        cellCount: sample.cells.length,
      };
      emitListFlow('query-signal-complete', {
        generation,
        reason,
        durationMs: Date.now() - startedAt,
        sampleCount,
        stable: Boolean(accepted),
        scrollTop,
        maxScroll: sample.scroll.maxScroll,
        firstCellIndex: normalized.firstCellIndex,
        lastCellIndex: normalized.lastCellIndex,
        cellCount: normalized.cellCount,
      });
      publishNormalizedSignal(normalized);
      return sample;
    } catch (error) {
      if (generation !== queryGenerationRef.current) return;
      emitListFlow('query-signal-failed', {
        generation,
        reason,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }, [emitListFlow, publishNormalizedSignal]);

  reconcileViewportRef.current = reconcileViewport;

  const refreshSignals = useCallback(async (reason: ListSignalQueryReason = 'manual') => {
    await reconcileViewport(reason);
  }, [reconcileViewport]);

  const recoverNativeList = useCallback((request: PositionVerificationRequest): Promise<void> => {
    const activeWaiter = recoveryLayoutWaiterRef.current;
    if (activeWaiter) {
      clearTimeout(activeWaiter.timer);
      activeWaiter.reject(new Error('Native list recovery superseded'));
      recoveryLayoutWaiterRef.current = null;
    }
    emitListFlow('native-list-remount-start', {
      transactionId: request.transactionId,
      operation: request.operation,
      targetKey: request.targetKey,
    });
    queryGenerationRef.current += 1;
    nativeSignalNormalizerRef.current.reset();
    lastNativeDiagnosticRef.current = { signature: '', timestamp: 0 };
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (recoveryLayoutWaiterRef.current?.timer !== timer) return;
        recoveryLayoutWaiterRef.current = null;
        reject(new Error(`Native list recovery layout timed out for ${request.targetKey}`));
      }, RECOVERY_LAYOUT_TIMEOUT_MS);
      recoveryLayoutWaiterRef.current = { resolve, reject, timer };
      const nextGeneration = nativeListGenerationRef.current + 1;
      nativeListGenerationRef.current = nextGeneration;
      setNativeListGeneration(nextGeneration);
    });
  }, [emitListFlow]);

  remountNativeListRef.current = recoverNativeList;

  const emitNativeSignal = useCallback(<T extends NativeListSignalType,>(
    type: T,
    event: NativeListEventMap[T],
  ) => {
    const signal = parseNativeListSignal(
      type,
      event,
      (cells) => driverRef.current!.normalizeCells(cells),
    );
    const distanceToEnd = signal.maxScroll !== undefined && signal.scrollTop !== undefined
      ? Math.max(0, signal.maxScroll - signal.scrollTop)
      : undefined;
    const nearDiagnosticEdge = signal.scrollTop === undefined
      || signal.scrollTop <= EDGE_DIAGNOSTIC_RANGE_PX
      || distanceToEnd !== undefined && distanceToEnd <= EDGE_DIAGNOSTIC_RANGE_PX;
    if (type !== 'scroll' || nearDiagnosticEdge) {
      const scrollBucket = signal.scrollTop === undefined
        ? 'unknown'
        : Math.round(signal.scrollTop / 50) * 50;
      const signature = JSON.stringify({
        type,
        eventSource: signal.eventSource,
        state: signal.state,
        scrollBucket,
        maxScroll: signal.maxScroll,
        firstCellIndex: signal.firstCellIndex,
        lastCellIndex: signal.lastCellIndex,
      });
      const now = Date.now();
      const previous = lastNativeDiagnosticRef.current;
      if (type !== 'scroll'
        || signature !== previous.signature && now - previous.timestamp >= NATIVE_DIAGNOSTIC_MIN_INTERVAL_MS) {
        lastNativeDiagnosticRef.current = { signature, timestamp: now };
        emitListFlow('native-signal', {
          type,
          eventSource: signal.eventSource,
          state: signal.state,
          scrollTop: signal.scrollTop,
          scrollHeight: signal.scrollHeight,
          listHeight: signal.listHeight,
          maxScroll: signal.maxScroll,
          distanceToEnd,
          firstCellIndex: signal.firstCellIndex,
          lastCellIndex: signal.lastCellIndex,
          cellCount: signal.cellCount,
        });
      }
    }
    callbacksRef.current.onNativeSignal?.(signal);
    for (const normalized of nativeSignalNormalizerRef.current.observe(signal)) {
      publishNormalizedSignal(normalized);
    }
  }, [emitListFlow, publishNormalizedSignal]);

  const handleLayoutChange = useCallback((event: any) => {
    const detail = event?.detail ?? event;
    const layout = detail?.layout ?? detail;
    if (typeof layout?.height === 'number' && layout.height >= 0) {
      viewportHeightRef.current = layout.height;
      setViewportHeight(layout.height);
    }
  }, []);

  const handleLayoutComplete = useCallback((event: ListLayoutCompleteEvent) => {
    emitNativeSignal('layoutcomplete', event);
    const recoveryWaiter = recoveryLayoutWaiterRef.current;
    if (recoveryWaiter) {
      clearTimeout(recoveryWaiter.timer);
      recoveryLayoutWaiterRef.current = null;
      emitListFlow('native-list-remount-layout-ready');
      recoveryWaiter.resolve();
    }
    const transactionId = pendingLayoutTransactionRef.current;
    if (transactionId !== null) {
      if (layoutCompletionFallbackRef.current) {
        clearTimeout(layoutCompletionFallbackRef.current);
        layoutCompletionFallbackRef.current = null;
      }
      pendingLayoutTransactionRef.current = null;
      driverRef.current!.notifyLayoutComplete(transactionId);
    }
    const cells = driverRef.current!.normalizeCells(nativeCells(event));
    if (initialPositioningRef.current === 'pending') {
      initialPositioningRef.current = 'running';
      const finish = (positionedCells: readonly ListCellMeasurement[]) => {
        initialPositioningRef.current = 'done';
        publishGeometry(positionedCells, 'initial-layout');
        void refreshSignals('initial-layout');
      };
      const targetKey = initialPosition === 'end'
        ? mountedKeysRef.current[mountedKeysRef.current.length - 1]
        : mountedKeysRef.current[0];
      if (!targetKey) {
        finish(cells);
        return;
      }
      setTimeout(() => {
        void driverRef.current!.scrollTo({
          key: targetKey,
          align: initialPosition,
          smooth: false,
        }).then(
          () => driverRef.current!.getVisibleCells().then(finish, () => finish(cells)),
          () => finish(cells),
        );
      }, 0);
      return;
    }
    if (initialPositioningRef.current === 'done') {
      publishGeometry(
        cells,
        geometryReason(layoutRevision === 0 ? 'initial-layout' : 'content-resize'),
      );
    }
  }, [emitListFlow, emitNativeSignal, geometryReason, initialPosition, layoutRevision, publishGeometry, refreshSignals]);

  const handleScroll = useCallback((event: ListScrollEvent) => {
    emitNativeSignal('scroll', event);
    const detail = event?.detail ?? event;
    const cells = driverRef.current!.normalizeCells(nativeCells(detail));
    // Lynx emits scroll for both gestures and our anchor-restoration calls. An active
    // transaction means this geometry was produced by content work, not by the user.
    const fallbackReason = initialPositioningRef.current !== 'done'
      ? 'initial-layout'
      : detail?.eventSource === 0 || detail?.eventSource === 1
        ? 'content-resize'
        : 'user-scroll';
    publishGeometry(cells, geometryReason(fallbackReason), nativeScrollMetrics(detail));
  }, [emitNativeSignal, geometryReason, publishGeometry]);

  const handleScrollToUpper = useCallback((event: ListScrollToUpperEvent) => {
    emitNativeSignal('scrolltoupper', event);
  }, [emitNativeSignal]);

  const handleScrollToLower = useCallback((event: ListScrollToLowerEvent) => {
    emitNativeSignal('scrolltolower', event);
  }, [emitNativeSignal]);

  const handleScrollStateChange = useCallback((event: ListScrollStateChangeEvent) => {
    emitNativeSignal('scrollstatechange', event);
    const state = event?.detail?.state;
    if (state !== SCROLL_STATE_DRAGGING && state !== SCROLL_STATE_STOP) return;
    // PITFALL (observed): when the list is already clamped at an edge, another
    // gesture may produce no `scroll` event because no pixel changed. Querying
    // on gesture start/stop lets the signal layer reconcile the actual `at`
    // state without trusting an old event snapshot.
    if (gestureQueryTimerRef.current) clearTimeout(gestureQueryTimerRef.current);
    gestureQueryTimerRef.current = setTimeout(() => {
      gestureQueryTimerRef.current = null;
      void refreshSignals('gesture');
    }, state === SCROLL_STATE_DRAGGING ? 32 : 0);
  }, [emitNativeSignal, refreshSignals]);

  const throwIfFailed = useCallback(async (result: Promise<ListTransactionResult>): Promise<void> => {
    const settled = await result;
    if (settled.outcome === 'failed') throw new Error(settled.reason ?? `${settled.operation} failed`);
  }, []);

  const getSnapshot = useCallback((): ListSnapshot<T> => {
    const edge = lastEdgeSnapshotRef.current ?? computeEdgeSnapshot({
      totalItems: itemsRef.current.length,
      cells: [],
      viewport: { start: 0, end: viewportHeightRef.current },
      threshold: edgeThreshold,
    });
    return snapshotFrom(edge);
  }, [edgeThreshold, snapshotFrom]);

  useImperativeHandle(ref, (): BidirectionalListController<T> => ({
    prepend: (nextItems, options) => engineRef.current!.prepend(nextItems, options),
    append: (nextItems, options) => engineRef.current!.append(nextItems, options),
    update: (key, updater) => engineRef.current!.update(key, updater),
    replace: (nextItems, options) => engineRef.current!.replace(nextItems, options),
    reset: (nextItems, options) => engineRef.current!.reset(nextItems, options),
    scrollToKey: (key, options) => throwIfFailed(engineRef.current!.navigateTo(key, options)),
    scrollToStart: async (options) => {
      const first = engineRef.current!.getItems()[0];
      if (first) await throwIfFailed(engineRef.current!.navigateTo(getItemKey(first), { align: 'start', ...options }));
    },
    scrollToEnd: async (options) => {
      const all = engineRef.current!.getItems();
      const last = all[all.length - 1];
      if (last) await throwIfFailed(engineRef.current!.navigateTo(getItemKey(last), { align: 'end', ...options }));
    },
    getSnapshot,
    getSignalSnapshot: () => signalMachineRef.current.getSnapshot(),
    refreshSignals,
  }), [getItemKey, getSnapshot, refreshSignals, throwIfFailed]);

  useEffect(() => () => {
    if (layoutCompletionFallbackRef.current) clearTimeout(layoutCompletionFallbackRef.current);
    if (gestureQueryTimerRef.current) clearTimeout(gestureQueryTimerRef.current);
    if (recoveryLayoutWaiterRef.current) {
      clearTimeout(recoveryLayoutWaiterRef.current.timer);
      recoveryLayoutWaiterRef.current.reject(new Error('Bidirectional list unmounted during recovery'));
      recoveryLayoutWaiterRef.current = null;
    }
    queryGenerationRef.current += 1;
    signalMachineRef.current.reset();
    driverRef.current?.dispose();
  }, []);

  return (
    <view className="bidirectional-list-shell">
      <list
        key={`${id}:${nativeListGeneration}`}
        id={`${id}--native-${nativeListGeneration}`}
        className="bidirectional-list"
        list-type="single"
        scroll-orientation="vertical"
        enable-scroll={true}
        bounces={bounces}
        initial-scroll-index={0}
        need-layout-complete-info={true}
        need-visible-item-info={true}
        layout-id={layoutRevision}
        preload-buffer-count={4}
        upper-threshold-item-count={0}
        lower-threshold-item-count={0}
        scroll-event-throttle={32}
        bindlayoutchange={handleLayoutChange}
        bindlayoutcomplete={handleLayoutComplete}
        bindscroll={handleScroll}
        bindscrolltoupper={handleScrollToUpper}
        bindscrolltolower={handleScrollToLower}
        bindscrollstatechange={handleScrollStateChange}
      >
        {items.map((item, absoluteIndex) => {
          return (
            <list-item
              key={getItemKey(item)}
              item-key={getItemKey(item)}
              className="bidirectional-list-item"
            >
              {renderItem(item, absoluteIndex)}
            </list-item>
          );
        })}
      </list>
    </view>
  );
}

export const BidirectionalList = forwardRef(BidirectionalListInner) as <T>(
  props: BidirectionalListProps<T> & { ref?: any },
) => any;
