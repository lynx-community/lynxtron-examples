import type { ListEventSource, ListScrollState } from '@lynx-js/types';
import type {
  AppendFollowRequest,
  AppendFollowSettlement,
  ListBoundarySignalState,
  ListEdge,
  ListMotionState,
  ListSignalEvent,
  ListSignalSnapshot,
  NormalizedNativeListSignal,
} from './types';

const SCROLL_STATE_STOP: ListScrollState = 1;
const SCROLL_STATE_DRAGGING: ListScrollState = 2;
const SCROLL_STATE_DECELERATE: ListScrollState = 3;
const SCROLL_STATE_ANIMATION: ListScrollState = 4;
const EVENT_SOURCE_SCROLL: ListEventSource = 2;
const EDGE_EPSILON_PX = 0.5;
const EDGE_REARM_DISTANCE_PX = 8;
const DEFAULT_NEAR_THRESHOLD_PX = 240;
const DEFAULT_FOLLOW_TIMEOUT_MS = 2_500;

interface PendingFollowWaiter {
  request: AppendFollowRequest;
  startedAfterRevision: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface UserGesture {
  id: number;
  armed: Record<ListEdge, boolean>;
  startedAt: Record<ListEdge, boolean>;
  repeated: Record<ListEdge, boolean>;
}

export interface ListSignalMachineOptions {
  nearThresholdPx?: number | { start: number; end: number };
  followTimeoutMs?: number;
}

function thresholds(value: ListSignalMachineOptions['nearThresholdPx']): {
  start: number;
  end: number;
} {
  const resolved = typeof value === 'number'
    ? { start: value, end: value }
    : value ?? { start: DEFAULT_NEAR_THRESHOLD_PX, end: DEFAULT_NEAR_THRESHOLD_PX };
  return {
    start: Math.max(0, resolved.start),
    end: Math.max(0, resolved.end),
  };
}

function unknownBoundary(): ListBoundarySignalState {
  return { known: false, at: false, near: false };
}

function motionFor(state: ListScrollState): ListMotionState {
  if (state === SCROLL_STATE_STOP) return 'idle';
  if (state === SCROLL_STATE_DRAGGING) return 'dragging';
  if (state === SCROLL_STATE_DECELERATE) return 'decelerating';
  if (state === SCROLL_STATE_ANIMATION) return 'animation';
  return 'unknown';
}

/**
 * Converts normalized native events into geometry-backed signals:
 *
 * - viewport truth is calculated from scroll geometry, never callback names;
 * - user edge events require an active DRAGGING/DECELERATE gesture and SCROLL
 *   geometry, so DIFF/layout work cannot impersonate user input;
 * - append-follow settles only after a newer geometry includes the appended
 *   boundary item and is at the exact pixel end.
 *
 * PITFALL (observed): `scrolltoupper`/`scrolltolower` can be associated with
 * layout/diff work as well as user scrolling. Their names are not proof of an
 * exact boundary or of user intent; event source, gesture state and geometry
 * are deliberately combined below.
 */
export class ListSignalMachine implements AppendFollowSettlement {
  private nearThreshold = thresholds(undefined);
  private readonly followTimeoutMs: number;
  private nextGestureId = 1;
  private userGesture: UserGesture | undefined;
  private pendingFollow: PendingFollowWaiter | undefined;
  private snapshot: ListSignalSnapshot = {
    revision: 0,
    motion: 'unknown',
    start: unknownBoundary(),
    end: unknownBoundary(),
    cellCount: 0,
  };

  constructor(options: ListSignalMachineOptions = {}) {
    this.nearThreshold = thresholds(options.nearThresholdPx);
    this.followTimeoutMs = options.followTimeoutMs ?? DEFAULT_FOLLOW_TIMEOUT_MS;
  }

  setNearThreshold(value: ListSignalMachineOptions['nearThresholdPx']): void {
    const next = thresholds(value);
    if (next.start === this.nearThreshold.start && next.end === this.nearThreshold.end) return;
    this.nearThreshold = next;
    if (!this.snapshot.geometry) return;
    this.snapshot = {
      ...this.snapshot,
      start: {
        ...this.snapshot.start,
        near: this.snapshot.geometry.distanceToStart <= this.nearThreshold.start,
      },
      end: {
        ...this.snapshot.end,
        near: this.snapshot.geometry.distanceToEnd <= this.nearThreshold.end,
      },
    };
  }

  getSnapshot(): ListSignalSnapshot {
    return {
      ...this.snapshot,
      start: { ...this.snapshot.start },
      end: { ...this.snapshot.end },
      geometry: this.snapshot.geometry ? { ...this.snapshot.geometry } : undefined,
      pendingFollow: this.snapshot.pendingFollow ? { ...this.snapshot.pendingFollow } : undefined,
    };
  }

  begin(request: AppendFollowRequest): Promise<void> {
    if (this.pendingFollow) {
      this.cancel(
        this.pendingFollow.request.transactionId,
        `Superseded by append-follow transaction ${request.transactionId}`,
      );
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingFollow?.request.transactionId !== request.transactionId) return;
        this.pendingFollow = undefined;
        this.snapshot = { ...this.snapshot, pendingFollow: undefined };
        reject(new Error(`Append-follow geometry timed out for transaction ${request.transactionId}`));
      }, this.followTimeoutMs);
      this.pendingFollow = {
        request,
        startedAfterRevision: this.snapshot.revision,
        resolve,
        reject,
        timer,
      };
      this.snapshot = { ...this.snapshot, pendingFollow: { ...request } };
    });
  }

  cancel(transactionId: number, reason: string): void {
    const pending = this.pendingFollow;
    if (!pending || pending.request.transactionId !== transactionId) return;
    clearTimeout(pending.timer);
    this.pendingFollow = undefined;
    this.snapshot = { ...this.snapshot, pendingFollow: undefined };
    pending.reject(new Error(reason));
  }

  observe(signal: NormalizedNativeListSignal): readonly ListSignalEvent[] {
    if (signal.type === 'scrollstatechange') return this.observeScrollState(signal.state);

    this.snapshot = this.snapshotFromGeometry(
      signal.geometry,
      signal.firstCellIndex,
      signal.lastCellIndex,
      signal.cellCount,
    );
    const events: ListSignalEvent[] = [];

    if (this.userGesture && signal.eventSource === EVENT_SOURCE_SCROLL) {
      for (const edge of ['start', 'end'] as const) {
        const atEdge = this.snapshot[edge].at;
        if (!atEdge && (this.snapshot[edge].distancePx ?? 0) > EDGE_REARM_DISTANCE_PX) {
          this.userGesture.armed[edge] = true;
        } else if (atEdge && this.userGesture.armed[edge]) {
          this.userGesture.armed[edge] = false;
          events.push({
            type: 'user-reached-edge',
            edge,
            gestureId: this.userGesture.id,
            snapshot: this.getSnapshot(),
          });
        }
      }

      // Repeated-edge is intentionally gesture-scoped. At a clamped boundary
      // there may be no changing scroll geometry, so the semantic upper/lower
      // callback is useful only after we have proven an active user gesture.
      const repeatedEdge = signal.trigger === 'scrolltoupper'
        ? 'start'
        : signal.trigger === 'scrolltolower'
          ? 'end'
          : undefined;
      if (
        repeatedEdge
        && this.snapshot[repeatedEdge].at
        && this.userGesture.startedAt[repeatedEdge]
        && !this.userGesture.repeated[repeatedEdge]
      ) {
        this.userGesture.repeated[repeatedEdge] = true;
        events.push({
          type: 'user-repeated-edge',
          edge: repeatedEdge,
          gestureId: this.userGesture.id,
          snapshot: this.getSnapshot(),
        });
      }
    }

    events.unshift({
      type: 'viewport',
      cause: signal.trigger === 'query' ? 'query' : 'geometry',
      queryReason: signal.queryReason,
      snapshot: this.getSnapshot(),
    });

    const pending = this.pendingFollow;
    if (
      pending
      && this.snapshot.revision > pending.startedAfterRevision
      && this.snapshot.end.at
      && (this.snapshot.lastCellIndex ?? -1) >= pending.request.expectedBoundaryIndex
    ) {
      clearTimeout(pending.timer);
      this.pendingFollow = undefined;
      this.snapshot = { ...this.snapshot, pendingFollow: undefined };
      pending.resolve();
      events.push({
        type: 'append-follow-settled',
        transactionId: pending.request.transactionId,
        snapshot: this.getSnapshot(),
      });
    }

    return events;
  }

  reset(): void {
    if (this.pendingFollow) {
      this.cancel(this.pendingFollow.request.transactionId, 'List signal machine reset');
    }
    this.nextGestureId = 1;
    this.userGesture = undefined;
    this.snapshot = {
      revision: 0,
      motion: 'unknown',
      start: unknownBoundary(),
      end: unknownBoundary(),
      cellCount: 0,
    };
  }

  private observeScrollState(state: ListScrollState): readonly ListSignalEvent[] {
    if (state === SCROLL_STATE_DRAGGING && !this.userGesture) {
      this.startUserGesture();
    } else if (state === SCROLL_STATE_STOP) {
      this.userGesture = undefined;
    }
    this.snapshot = {
      ...this.snapshot,
      motion: motionFor(state),
      userGestureId: this.userGesture?.id,
    };
    return [{
      type: 'viewport',
      cause: 'scroll-state',
      snapshot: this.getSnapshot(),
    }];
  }

  private startUserGesture(): void {
    this.userGesture = {
      id: this.nextGestureId++,
      armed: {
        start: !this.snapshot.start.at,
        end: !this.snapshot.end.at,
      },
      startedAt: {
        start: this.snapshot.start.at,
        end: this.snapshot.end.at,
      },
      repeated: {
        start: false,
        end: false,
      },
    };
  }

  private snapshotFromGeometry(
    geometry: NonNullable<ListSignalSnapshot['geometry']>,
    firstCellIndex: number | undefined,
    lastCellIndex: number | undefined,
    cellCount: number,
  ): ListSignalSnapshot {
    return {
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      start: {
        known: true,
        at: geometry.distanceToStart <= EDGE_EPSILON_PX,
        near: geometry.distanceToStart <= this.nearThreshold.start,
        distancePx: geometry.distanceToStart,
      },
      end: {
        known: true,
        at: geometry.distanceToEnd <= EDGE_EPSILON_PX,
        near: geometry.distanceToEnd <= this.nearThreshold.end,
        distancePx: geometry.distanceToEnd,
      },
      geometry: { ...geometry },
      firstCellIndex,
      lastCellIndex,
      cellCount,
      pendingFollow: this.pendingFollow ? { ...this.pendingFollow.request } : undefined,
    };
  }
}
