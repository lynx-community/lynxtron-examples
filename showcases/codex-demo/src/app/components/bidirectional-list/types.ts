import type { ListEventSource, ListScrollState } from '@lynx-js/types';

export type ListEdge = 'start' | 'end';

export type ListAlignment = 'start' | 'center' | 'end';

export type InsertPositionPolicy =
  | { type: 'preserve' }
  | {
    type: 'follow-insert';
    target?: 'first' | 'last';
    align?: ListAlignment;
    smooth?: boolean;
  };

export interface InsertOptions {
  position?: InsertPositionPolicy;
}

export interface ScrollToOptions {
  align?: ListAlignment;
  smooth?: boolean;
}

export interface ReplaceOptions {
  position?: 'preserve' | 'start' | 'end' | { key: string; align?: ListAlignment };
}

export interface EdgeStatus {
  /** The supplied sequence boundary is visible or leaves blank viewport space. */
  reached: boolean;
  /** The visible range is within the configured item threshold of this edge. */
  near: boolean;
}

export interface EdgeSnapshot {
  start: EdgeStatus;
  end: EdgeStatus;
  firstVisibleKey?: string;
  lastVisibleKey?: string;
  firstVisibleIndex: number;
  lastVisibleIndex: number;
  totalItems: number;
  geometry: {
    source: 'empty' | 'unavailable' | 'scroll-metrics' | 'cells';
    scrollTop?: number;
    scrollHeight?: number;
    listHeight?: number;
    maxScroll?: number;
    distanceToEnd?: number;
    firstTop?: number;
    firstBottom?: number;
    lastTop?: number;
    lastBottom?: number;
  };
}

export type EdgeReachedReason =
  | 'initial-layout'
  | 'user-scroll'
  | 'insert'
  | 'navigation'
  | 'content-resize';

export type EdgeReachedOrigin = 'initial' | 'user' | 'content';

export interface EdgeReachedEvent {
  edge: ListEdge;
  episodeId: number;
  /** High-level cause: direct user gesture, content/layout work, or first layout. */
  origin: EdgeReachedOrigin;
  /** Concrete geometry producer within that origin. */
  reason: EdgeReachedReason;
  status: EdgeStatus;
  snapshot: EdgeSnapshot;
}

export interface ListRange {
  start: number;
  /** Exclusive. */
  end: number;
}

export type ListMutationKind = 'prepend' | 'append' | 'update' | 'replace' | 'reset' | 'navigate';

export type ListTransactionPhase =
  | 'idle'
  | 'capturing-anchor'
  | 'committing'
  | 'waiting-layout'
  | 'restoring'
  | 'verifying';

export interface ListTransactionResult {
  id: number;
  operation: ListMutationKind;
  outcome: 'settled' | 'cancelled' | 'failed';
  reason?: string;
  anchorErrorPx?: number;
}

export interface ListSnapshot<T> extends EdgeSnapshot {
  items: readonly T[];
  visibleRange: ListRange;
  transaction:
    | { status: 'idle' }
    | { status: Exclude<ListTransactionPhase, 'idle'>; id: number; operation: ListMutationKind };
}

export interface BidirectionalListController<T> {
  prepend(items: readonly T[], options?: InsertOptions): Promise<ListTransactionResult>;
  append(items: readonly T[], options?: InsertOptions): Promise<ListTransactionResult>;
  update(key: string, updater: T | ((current: T) => T)): Promise<ListTransactionResult>;
  replace(items: readonly T[], options?: ReplaceOptions): Promise<ListTransactionResult>;
  reset(
    items: readonly T[],
    options?: { position?: 'start' | 'end' | { key: string; align?: ListAlignment } },
  ): Promise<ListTransactionResult>;
  scrollToKey(key: string, options?: ScrollToOptions): Promise<void>;
  scrollToStart(options?: Omit<ScrollToOptions, 'align'>): Promise<void>;
  scrollToEnd(options?: Omit<ScrollToOptions, 'align'>): Promise<void>;
  getSnapshot(): ListSnapshot<T>;
  /** Last geometry-backed viewport state. `known` is false before the first stable signal. */
  getSignalSnapshot(): ListSignalSnapshot;
  /**
   * Actively re-sample native scroll geometry and publish it through onListSignal.
   * Consumers request reconciliation but never receive or interpret raw Lynx data.
   */
  refreshSignals(reason?: ListSignalQueryReason): Promise<void>;
}

/** Raw platform visibility is intentionally isolated from application data models. */
export interface BidirectionalListDiagnostics {
  onNativeSignal?: (signal: NativeListSignal) => void;
  onNormalizedNativeSignal?: (signal: NormalizedNativeListSignal) => void;
  /** Sampled, serializable internal flow records for external log transport. */
  onFlow?: (record: Record<string, unknown>) => void;
}

export interface BidirectionalListProps<T> {
  id: string;
  initialItems: readonly T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => any;
  estimateItemSize?: (item: T, index: number) => number;
  initialPosition?: 'start' | 'end';
  /** Whether the native list may move beyond its scroll boundary. Defaults to true. */
  bounces?: boolean;
  edgeThreshold?: number | { start: number; end: number };
  /** Pixel distance used by the reliable base signal layer. Defaults to 240 px. */
  signalNearThresholdPx?: number | { start: number; end: number };
  onEdgeStateChange?: (snapshot: EdgeSnapshot) => void;
  onStartReached?: (event: EdgeReachedEvent) => void;
  onEndReached?: (event: EdgeReachedEvent) => void;
  onWindowChange?: (snapshot: ListSnapshot<T>) => void;
  onTransactionSettled?: (result: ListTransactionResult) => void;
  /** Lab/debug channel only. Business logic must consume onListSignal. */
  diagnostics?: BidirectionalListDiagnostics;
  onListSignal?: (signal: ListSignalEvent) => void;
}

export interface ListCellMeasurement {
  key: string;
  index: number;
  top: number;
  bottom: number;
}

export type NativeListSignalType =
  | 'layoutcomplete'
  | 'scroll'
  | 'scrolltoupper'
  | 'scrolltolower'
  | 'scrollstatechange';

/** Primitive-only diagnostic payload for validating native Lynx list behavior. */
export interface NativeListSignal {
  type: NativeListSignalType;
  eventSource?: ListEventSource;
  state?: ListScrollState;
  scrollTop?: number;
  scrollHeight?: number;
  listHeight?: number;
  maxScroll?: number;
  firstCellIndex?: number;
  lastCellIndex?: number;
  firstCellTop?: number;
  lastCellBottom?: number;
  cellCount: number;
}

export interface NormalizedNativeListGeometry {
  scrollTop: number;
  scrollHeight: number;
  listHeight: number;
  maxScroll: number;
  distanceToStart: number;
  distanceToEnd: number;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * Schema-stable primitives derived from native list events. A geometry signal
 * is trustworthy for the instant it was emitted, but does not imply that an
 * imperative scroll transaction has settled.
 */
export type NormalizedNativeListSignal =
  | {
    type: 'geometry';
    trigger: 'scroll' | 'scrolltoupper' | 'scrolltolower' | 'query';
    queryReason?: ListSignalQueryReason;
    eventSource: ListEventSource;
    geometry: NormalizedNativeListGeometry;
    firstCellIndex?: number;
    lastCellIndex?: number;
    cellCount: number;
  }
  | {
    type: 'scrollstatechange';
    state: ListScrollState;
  };

export type ListMotionState = 'unknown' | 'idle' | 'dragging' | 'decelerating' | 'animation';

export interface ListBoundarySignalState {
  /** False until at least one stable LAYOUT/SCROLL geometry has been observed. */
  known: boolean;
  /** Exact geometry edge, with a sub-pixel tolerance. */
  at: boolean;
  /** Within the configured pixel threshold of this edge. */
  near: boolean;
  distancePx?: number;
}

export interface ListPendingFollow {
  transactionId: number;
  operation: 'append';
  edge: 'end';
  expectedBoundaryIndex: number;
}

/**
 * Stable, queryable state derived from normalized list geometry. Native
 * `scrolltoupper`/`scrolltolower` names are deliberately not treated as proof
 * of a pixel boundary.
 */
export interface ListSignalSnapshot {
  revision: number;
  motion: ListMotionState;
  userGestureId?: number;
  start: ListBoundarySignalState;
  end: ListBoundarySignalState;
  geometry?: NormalizedNativeListGeometry;
  firstCellIndex?: number;
  lastCellIndex?: number;
  cellCount: number;
  pendingFollow?: ListPendingFollow;
}

export type ListSignalQueryReason = 'initial-layout' | 'gesture' | 'content-settled' | 'manual';

export type ListSignalEvent =
  | {
    type: 'viewport';
    cause: 'geometry' | 'scroll-state' | 'query';
    queryReason?: ListSignalQueryReason;
    snapshot: ListSignalSnapshot;
  }
  | {
    type: 'user-reached-edge';
    edge: ListEdge;
    gestureId: number;
    snapshot: ListSignalSnapshot;
  }
  | {
    /** A new gesture began at an exact edge and continued toward that edge. */
    type: 'user-repeated-edge';
    edge: ListEdge;
    gestureId: number;
    snapshot: ListSignalSnapshot;
  }
  | {
    type: 'append-follow-settled';
    transactionId: number;
    snapshot: ListSignalSnapshot;
  };

export interface AppendFollowRequest {
  transactionId: number;
  operation: 'append';
  edge: 'end';
  expectedBoundaryIndex: number;
}

export interface AppendFollowSettlement {
  begin(request: AppendFollowRequest): Promise<void>;
  cancel(transactionId: number, reason: string): void;
}


export interface ListViewportMeasurement {
  start: number;
  end: number;
}

export interface ListScrollMeasurement {
  scrollTop: number;
  scrollHeight: number;
  listHeight: number;
  maxScroll: number;
}

export interface BidirectionalListDriver {
  getViewport(): Promise<ListViewportMeasurement>;
  getVisibleCells(): Promise<readonly ListCellMeasurement[]>;
  getScrollInfo(): Promise<ListScrollMeasurement>;
  scrollTo(input: {
    key: string;
    align: ListAlignment;
    offset?: number;
    smooth?: boolean;
  }): Promise<void>;
  waitForLayout(transactionId: number): Promise<void>;
}
