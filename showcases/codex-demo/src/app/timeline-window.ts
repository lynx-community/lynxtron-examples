import type { TimelineEntry } from '../shared/agent';

export const INITIAL_TIMELINE_ITEM_COUNT = 3;
export const TIMELINE_PREFETCH_BUFFER_ITEMS = 6;
export const TIMELINE_REFILL_ITEMS = 3;
export const TIMELINE_TARGET_BUFFER_ITEMS = TIMELINE_PREFETCH_BUFFER_ITEMS + TIMELINE_REFILL_ITEMS;
export const TIMELINE_REMOTE_PAGE_ITEMS = 24;
export const TIMELINE_INITIAL_PAGE_ITEMS = 18;
/** Hard cap only. The mounted range still grows incrementally from the latest three items. */
export const TIMELINE_MAX_MOUNTED_ITEMS = 500;
export const HISTORY_LOADER_MIN_VISIBLE_MS = 160;

export interface TimelineWindow {
  start: number;
  end: number;
}

export function timelineWindowSize(window: TimelineWindow): number {
  return Math.max(0, window.end - window.start);
}

export function normalizeTimelineWindow(
  window: TimelineWindow,
  totalCount: number,
  maxCount = TIMELINE_MAX_MOUNTED_ITEMS,
): TimelineWindow {
  const total = Math.max(0, Math.floor(totalCount));
  const end = Math.max(0, Math.min(total, Math.floor(window.end)));
  const start = Math.max(0, Math.min(end, Math.floor(window.start)));
  return { start: Math.max(start, end - maxCount), end };
}

export function latestTimelineWindow(
  totalCount: number,
  count = INITIAL_TIMELINE_ITEM_COUNT,
): TimelineWindow {
  const end = Math.max(0, Math.floor(totalCount));
  return { start: Math.max(0, end - count), end };
}

/** Reveal older loaded entries and evict the same number from the far (newer) edge once capped. */
export function shiftTimelineWindowEarlier(
  window: TimelineWindow,
  revealCount: number,
  totalCount: number,
  maxCount = TIMELINE_MAX_MOUNTED_ITEMS,
): TimelineWindow {
  const reveal = Math.min(Math.max(0, Math.floor(revealCount)), Math.max(0, window.start));
  const start = window.start - reveal;
  const end = Math.min(totalCount, Math.min(window.end, start + maxCount));
  return normalizeTimelineWindow({ start, end }, totalCount, maxCount);
}

/** Rebase a window after older entries were prepended to the backing array. */
export function rebaseTimelineWindowAfterPrepend(
  window: TimelineWindow,
  addedCount: number,
  revealCount: number,
  totalCount: number,
  maxCount = TIMELINE_MAX_MOUNTED_ITEMS,
): TimelineWindow {
  const added = Math.max(0, Math.floor(addedCount));
  const reveal = Math.min(added, Math.max(0, Math.floor(revealCount)));
  const start = Math.max(0, window.start + added - reveal);
  const end = Math.min(totalCount, Math.min(window.end + added, start + maxCount));
  return normalizeTimelineWindow({ start, end }, totalCount, maxCount);
}

/** Reveal newer loaded entries and evict old entries from the opposite edge once capped. */
export function shiftTimelineWindowLater(
  window: TimelineWindow,
  revealCount: number,
  totalCount: number,
  maxCount = TIMELINE_MAX_MOUNTED_ITEMS,
): TimelineWindow {
  const available = Math.max(0, totalCount - window.end);
  const reveal = Math.min(available, Math.max(0, Math.floor(revealCount)));
  const end = window.end + reveal;
  const start = Math.max(0, Math.max(window.start, end - maxCount));
  return normalizeTimelineWindow({ start, end }, totalCount, maxCount);
}

export interface TimelineCellPosition {
  itemKey?: string;
  'item-key'?: string;
  top?: number;
  bottom?: number;
}

export interface TimelineAnchor {
  itemKey: string;
  index: number;
  top: number;
}

export function resolveTimelineAnchor<T extends { itemKey: string }>(
  candidates: T[],
  visibleKeys: Set<string>,
): T | null {
  return candidates.find((candidate) => visibleKeys.has(candidate.itemKey)) ?? null;
}

export function timelineLayoutId(items: TimelineEntry[]): number {
  const firstId = items[0]?.id ?? '';
  let hash = items.length + 17;
  for (let index = 0; index < firstId.length; index += 1) {
    hash = ((hash * 31) + firstId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export interface RevealPlan {
  localCount: number;
  revealCount: number;
  remoteCount: number;
}

export function shouldChainRemoteReveal(plan: RevealPlan, hasEarlier: boolean): boolean {
  return hasEarlier && plan.localCount > 0 && plan.localCount < plan.revealCount;
}

export function historyLoaderTransition(input: {
  loading: boolean;
  visible: boolean;
  shownAt: number;
  now: number;
}): { visible: boolean; hideAfterMs: number | null } {
  if (input.loading) return { visible: true, hideAfterMs: null };
  if (!input.visible) return { visible: false, hideAfterMs: null };
  return {
    visible: true,
    hideAfterMs: Math.max(0, HISTORY_LOADER_MIN_VISIBLE_MS - (input.now - input.shownAt)),
  };
}

export function isTerminalRevealPhase(phase: unknown): boolean {
  return phase === 'complete';
}

export function findTimelineAnchor(
  cells: TimelineCellPosition[] | undefined,
  visibleItems: TimelineEntry[],
): TimelineAnchor | null {
  if (!Array.isArray(cells)) return null;
  const indices = new Map(visibleItems.map((item, index) => [item.id, index]));
  let firstAttached: TimelineAnchor | null = null;
  let firstFullyVisible: TimelineAnchor | null = null;
  for (const cell of cells) {
    const itemKey = cell.itemKey ?? cell['item-key'];
    if (typeof itemKey !== 'string') continue;
    const index = indices.get(itemKey);
    if (index === undefined) continue;
    const candidate = {
      itemKey,
      index,
      top: typeof cell.top === 'number' ? cell.top : 0,
    };
    if (!firstAttached || candidate.index < firstAttached.index) firstAttached = candidate;
    if (
      candidate.top >= 0
      && (!firstFullyVisible || candidate.index < firstFullyVisible.index)
    ) firstFullyVisible = candidate;
  }
  return firstFullyVisible ?? firstAttached;
}

/** scrollToPosition offset needed after measuring the zero-offset aligned anchor. */
export function anchorCorrectionOffset(actualTop: number, desiredTop: number): number {
  return desiredTop - actualTop;
}

export function timelineListPosition(visibleItemIndex: number, hasTopSpacer = false): number {
  return Math.max(0, Math.floor(visibleItemIndex)) + 1 + (hasTopSpacer ? 1 : 0);
}

export function shouldRestoreAnchor(requestGeneration: number, currentGeneration: number): boolean {
  return requestGeneration === currentGeneration;
}

export function attachedCellsFromResult(value: unknown, depth = 0): TimelineCellPosition[] {
  if (depth > 3 || value == null) return [];
  if (typeof value === 'string') {
    try {
      return attachedCellsFromResult(JSON.parse(value), depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as TimelineCellPosition[];
  if (typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.attachedCells)) return record.attachedCells as TimelineCellPosition[];
  for (const key of ['data', 'result', 'detail', 'value']) {
    const cells = attachedCellsFromResult(record[key], depth + 1);
    if (cells.length > 0) return cells;
  }
  return [];
}

export function planEarlierReveal(input: {
  availableAbove: number;
  visibleCount: number;
  totalCount: number;
  hasEarlier: boolean;
}): RevealPlan {
  const availableAbove = Math.max(0, Math.floor(input.availableAbove));
  const desired = Math.max(0, TIMELINE_TARGET_BUFFER_ITEMS - availableAbove);
  const localCount = Math.min(
    desired,
    Math.max(0, input.totalCount - input.visibleCount),
  );
  return {
    localCount,
    revealCount: desired > 0 && (localCount > 0 || input.hasEarlier) ? desired : 0,
    remoteCount: desired > 0 && localCount === 0 && input.hasEarlier
      ? Math.max(TIMELINE_REMOTE_PAGE_ITEMS, desired)
      : 0,
  };
}

export function revealCountForRemotePage(addedCount: number, requestedRevealCount: number): number {
  const boundedAdded = Math.max(0, Math.floor(addedCount));
  const minimumProgress = Math.min(TIMELINE_REFILL_ITEMS, boundedAdded);
  const preservingBuffer = Math.max(0, boundedAdded - TIMELINE_PREFETCH_BUFFER_ITEMS);
  return Math.min(
    Math.max(0, requestedRevealCount),
    Math.max(minimumProgress, preservingBuffer),
  );
}

function visualLineCount(text: string, charactersPerLine = 66): number {
  if (!text) return 1;
  let lines = 0;
  let inCodeFence = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      lines += 1;
      continue;
    }
    const wrapping = Math.max(1, Math.ceil(line.length / charactersPerLine));
    const markdownBlock = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(line);
    lines += wrapping + (markdownBlock ? 0.35 : 0) + (inCodeFence ? 0.15 : 0);
  }
  return Math.max(1, Math.ceil(lines));
}

/** Estimate only guides Lynx recycling; it must never be used as a visual min-height. */
export function estimateTimelineItemHeight(item: TimelineEntry): number {
  if (item.kind === 'tool') {
    const toolLines = visualLineCount(item.tool?.text ?? item.tool?.title ?? '', 58);
    return Math.min(1200, Math.max(88, 60 + toolLines * 20));
  }
  if (item.kind === 'plan') return 54 + (item.plan?.length ?? 0) * 34;
  const lineHeight = item.kind === 'user' ? 22 : 23;
  const padding = item.kind === 'user' ? 36 : 30;
  const height = visualLineCount(item.text ?? '') * lineHeight + padding;
  return Math.min(4000, Math.max(item.kind === 'user' ? 62 : 54, height));
}

export class TimelineHeightCache {
  private readonly values = new Map<string, number>();

  get(itemKey: string): number | undefined {
    return this.values.get(itemKey);
  }

  set(itemKey: string, height: number): boolean {
    if (this.values.get(itemKey) === height) return false;
    this.values.set(itemKey, height);
    return true;
  }

  sum(items: TimelineEntry[]): number {
    return items.reduce(
      (height, item) => height + (this.values.get(item.id) ?? estimateTimelineItemHeight(item)),
      0,
    );
  }

  hasAll(items: TimelineEntry[]): boolean {
    return items.every((item) => this.values.has(item.id));
  }

  prune(validKeys: Set<string>): void {
    for (const key of this.values.keys()) {
      if (!validKeys.has(key)) this.values.delete(key);
    }
  }

  get size(): number {
    return this.values.size;
  }
}
