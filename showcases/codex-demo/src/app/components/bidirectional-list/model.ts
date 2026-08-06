import type {
  EdgeReachedEvent,
  EdgeReachedReason,
  EdgeSnapshot,
  ListCellMeasurement,
  ListViewportMeasurement,
} from './types';

export const DEFAULT_EDGE_THRESHOLD = 3;
export const EDGE_EPSILON_PX = 1;

function orderedVisibleCells(cells: readonly ListCellMeasurement[]): ListCellMeasurement[] {
  return [...cells].sort((a, b) => a.index - b.index);
}

export function computeEdgeSnapshot(input: {
  totalItems: number;
  cells: readonly ListCellMeasurement[];
  viewport: ListViewportMeasurement;
  scrollMetrics?: {
    scrollTop: number;
    scrollHeight: number;
    listHeight: number;
  };
  threshold?: number | { start: number; end: number };
}): EdgeSnapshot {
  const { totalItems, viewport } = input;
  const cells = orderedVisibleCells(input.cells);
  const first = cells[0];
  const last = cells[cells.length - 1];
  const threshold = typeof input.threshold === 'number'
    ? { start: input.threshold, end: input.threshold }
    : input.threshold ?? { start: DEFAULT_EDGE_THRESHOLD, end: DEFAULT_EDGE_THRESHOLD };
  const empty = totalItems === 0;
  const firstVisibleIndex = first?.index ?? -1;
  const lastVisibleIndex = last?.index ?? -1;
  const metrics = input.scrollMetrics;
  const hasScrollMetrics = metrics !== undefined
    && Number.isFinite(metrics.scrollTop)
    && Number.isFinite(metrics.scrollHeight)
    && Number.isFinite(metrics.listHeight)
    && metrics.scrollHeight >= 0
    && metrics.listHeight > 0;
  const startReached = empty || (hasScrollMetrics
    ? metrics!.scrollTop <= EDGE_EPSILON_PX
    : cells.length > 0 && firstVisibleIndex === 0
      && (first?.top ?? viewport.start) >= viewport.start - EDGE_EPSILON_PX);
  const endReached = empty || (hasScrollMetrics
    ? metrics!.scrollHeight <= metrics!.listHeight + EDGE_EPSILON_PX
      || metrics!.scrollTop + metrics!.listHeight >= metrics!.scrollHeight - EDGE_EPSILON_PX
    : cells.length > 0 && lastVisibleIndex === totalItems - 1
      && (last?.bottom ?? viewport.end) <= viewport.end + EDGE_EPSILON_PX);

  return {
    start: {
      reached: startReached,
      near: empty || cells.length > 0 && firstVisibleIndex <= Math.max(0, threshold.start),
    },
    end: {
      reached: endReached,
      near: empty || cells.length > 0
        && totalItems - 1 - lastVisibleIndex <= Math.max(0, threshold.end),
    },
    firstVisibleKey: first?.key,
    lastVisibleKey: last?.key,
    firstVisibleIndex,
    lastVisibleIndex,
    totalItems,
    geometry: {
      source: totalItems === 0
        ? 'empty'
        : hasScrollMetrics
          ? 'scroll-metrics'
          : cells.length > 0
            ? 'cells'
            : 'unavailable',
      ...(hasScrollMetrics ? {
        scrollTop: metrics!.scrollTop,
        scrollHeight: metrics!.scrollHeight,
        listHeight: metrics!.listHeight,
        maxScroll: Math.max(0, metrics!.scrollHeight - metrics!.listHeight),
        distanceToEnd: Math.max(0, metrics!.scrollHeight - metrics!.listHeight - metrics!.scrollTop),
      } : {}),
      firstTop: first?.top,
      firstBottom: first?.bottom,
      lastTop: last?.top,
      lastBottom: last?.bottom,
    },
  };
}

export function firstStableAnchor(
  cells: readonly ListCellMeasurement[],
  viewportStart: number,
): ListCellMeasurement | null {
  const ordered = orderedVisibleCells(cells);
  return ordered.find((cell) => cell.top >= viewportStart - EDGE_EPSILON_PX) ?? ordered[0] ?? null;
}

export function anchorCorrection(actualTop: number, desiredTop: number): number {
  return desiredTop - actualTop;
}

/**
 * Deduplicates reached notifications by edge episode. A supplied-data revision while an edge
 * remains reached starts a new episode so an underfilled list can request another batch.
 */
export class EdgeEpisodeTracker {
  private nextEpisodeId = 1;
  private readonly active = {
    start: { reached: false, revision: -1 },
    end: { reached: false, revision: -1 },
  };

  observe(
    snapshot: EdgeSnapshot,
    reason: EdgeReachedReason,
    revision: number,
  ): EdgeReachedEvent[] {
    const events: EdgeReachedEvent[] = [];
    for (const edge of ['start', 'end'] as const) {
      const status = snapshot[edge];
      const previous = this.active[edge];
      if (!status.reached) {
        previous.reached = false;
        previous.revision = revision;
        continue;
      }
      if (!previous.reached || previous.revision !== revision) {
        events.push({
          edge,
          episodeId: this.nextEpisodeId++,
          origin: reason === 'user-scroll'
            ? 'user'
            : reason === 'initial-layout'
              ? 'initial'
              : 'content',
          reason,
          status,
          snapshot,
        });
      }
      previous.reached = true;
      previous.revision = revision;
    }
    return events;
  }

  reset(): void {
    this.active.start = { reached: false, revision: -1 };
    this.active.end = { reached: false, revision: -1 };
  }
}
