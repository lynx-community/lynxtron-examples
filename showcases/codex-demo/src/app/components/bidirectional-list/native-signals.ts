import type {
  ListAttachedCell,
  ListLayoutCompleteEvent,
  ListScrollEvent,
  ListScrollStateChangeEvent,
  ListScrollToLowerEvent,
  ListScrollToUpperEvent,
} from '@lynx-js/types';
import type {
  ListCellMeasurement,
  NativeListSignal,
  NativeListSignalType,
  NormalizedNativeListSignal,
} from './types';

export interface NativeListEventMap {
  layoutcomplete: ListLayoutCompleteEvent;
  scroll: ListScrollEvent;
  scrolltoupper: ListScrollToUpperEvent;
  scrolltolower: ListScrollToLowerEvent;
  scrollstatechange: ListScrollStateChangeEvent;
}

export type NativeListEvent = NativeListEventMap[NativeListSignalType];

/**
 * Converts the two native payload shapes (`detail` and
 * `detail.scrollInfo`) into the primitive-only signal exposed by the list.
 * PITFALL (observed): assuming one shape silently loses geometry for the other
 * event family, leaving `at`/`near` stuck on a stale value.
 * No edge semantics or de-duplication belongs here: consumers must still
 * distinguish DIFF, LAYOUT, and SCROLL event sources.
 */
export function parseNativeListSignal<T extends NativeListSignalType>(
  type: T,
  event: NativeListEventMap[T],
  normalizeCells: (cells: readonly ListAttachedCell[]) => readonly ListCellMeasurement[],
): NativeListSignal {
  const scrollInfo = type === 'layoutcomplete'
    ? (event as ListLayoutCompleteEvent).detail.scrollInfo
    : type === 'scrollstatechange'
      ? undefined
      : (event as ListScrollEvent | ListScrollToUpperEvent | ListScrollToLowerEvent).detail;
  const state = type === 'scrollstatechange'
    ? (event as ListScrollStateChangeEvent).detail.state
    : undefined;
  const cells = normalizeCells(scrollInfo?.attachedCells ?? []);
  const hasMetrics = typeof scrollInfo?.scrollTop === 'number'
    && typeof scrollInfo?.scrollHeight === 'number'
    && typeof scrollInfo?.listHeight === 'number';

  return {
    type,
    eventSource: typeof scrollInfo?.eventSource === 'number' ? scrollInfo.eventSource : undefined,
    state,
    scrollTop: hasMetrics ? scrollInfo.scrollTop : undefined,
    scrollHeight: hasMetrics ? scrollInfo.scrollHeight : undefined,
    listHeight: hasMetrics ? scrollInfo.listHeight : undefined,
    maxScroll: hasMetrics ? Math.max(0, scrollInfo.scrollHeight - scrollInfo.listHeight) : undefined,
    firstCellIndex: cells[0]?.index,
    lastCellIndex: cells[cells.length - 1]?.index,
    firstCellTop: cells[0]?.top,
    lastCellBottom: cells[cells.length - 1]?.bottom,
    cellCount: cells.length,
  };
}

const EDGE_EPSILON_PX = 0.5;

/**
 * Removes native pipeline noise without inventing transaction semantics:
 * - DIFF geometry is transient and not forwarded.
 * - layoutcomplete remains available through onNativeSignal but is not a
 *   final-position signal because an imperative follow scroll may run next.
 * - equivalent LAYOUT/SCROLL geometry is emitted once.
 * - scroll state is an independent, de-duplicated channel.
 */
export class NativeListSignalNormalizer {
  private lastGeometrySignature = '';
  private lastScrollState: number | undefined;

  observe(signal: NativeListSignal): readonly NormalizedNativeListSignal[] {
    if (signal.type === 'scrollstatechange') {
      if (signal.state === undefined || signal.state === this.lastScrollState) return [];
      this.lastScrollState = signal.state;
      return [{ type: 'scrollstatechange', state: signal.state }];
    }

    if (
      signal.type === 'layoutcomplete'
      || signal.eventSource !== 1 && signal.eventSource !== 2
      || signal.scrollTop === undefined
      || signal.scrollHeight === undefined
      || signal.listHeight === undefined
      || signal.maxScroll === undefined
    ) return [];

    const signature = [
      signal.scrollTop,
      signal.scrollHeight,
      signal.listHeight,
      signal.firstCellIndex ?? '',
      signal.lastCellIndex ?? '',
      signal.firstCellTop ?? '',
      signal.lastCellBottom ?? '',
      signal.cellCount,
    ].join('|');
    const distanceToStart = Math.max(0, signal.scrollTop);
    const distanceToEnd = Math.max(0, signal.maxScroll - signal.scrollTop);
    const isExactUserBoundarySignal = signal.eventSource === 2
      && (signal.type === 'scrolltoupper' && distanceToStart <= EDGE_EPSILON_PX
        || signal.type === 'scrolltolower' && distanceToEnd <= EDGE_EPSILON_PX);
    // PITFALL (observed): equal geometry is normally pipeline noise, but a user
    // upper/lower callback at the exact edge represents a repeated gesture even
    // though the platform clamps scrollTop to the same pixel. Geometry-only
    // de-duplication would erase that interaction.
    if (signature === this.lastGeometrySignature && !isExactUserBoundarySignal) return [];
    this.lastGeometrySignature = signature;

    return [{
      type: 'geometry',
      trigger: signal.type,
      eventSource: signal.eventSource,
      geometry: {
        scrollTop: signal.scrollTop,
        scrollHeight: signal.scrollHeight,
        listHeight: signal.listHeight,
        maxScroll: signal.maxScroll,
        distanceToStart,
        distanceToEnd,
        atStart: distanceToStart <= EDGE_EPSILON_PX,
        atEnd: distanceToEnd <= EDGE_EPSILON_PX,
      },
      firstCellIndex: signal.firstCellIndex,
      lastCellIndex: signal.lastCellIndex,
      cellCount: signal.cellCount,
    }];
  }

  reset(): void {
    this.lastGeometrySignature = '';
    this.lastScrollState = undefined;
  }
}
