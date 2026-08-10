import type {
  BidirectionalListDriver,
  ListAlignment,
  ListCellMeasurement,
  ListScrollMeasurement,
  ListViewportMeasurement,
} from './types';

interface NativeListCell {
  itemKey?: string;
  'item-key'?: string;
  top?: number;
  bottom?: number;
}

export interface LynxListDriverOptions {
  id?: string;
  getNativeId?: () => string;
  getViewportHeight: () => number;
  getMountedKeys: () => readonly string[];
  layoutTimeoutMs?: number;
}

function cellsFromResult(result: any): NativeListCell[] {
  // PITFALL (defensive): Lynx versions/hosts have returned the cell array under
  // different keys. Normalize at the adapter boundary so the state machine
  // never needs to know which native payload shape was used.
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.cells)) return result.cells;
  if (Array.isArray(result?.visibleCells)) return result.visibleCells;
  if (Array.isArray(result?.attachedCells)) return result.attachedCells;
  return [];
}

function objectFromResult(result: any): any {
  if (typeof result !== 'string') return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

export function lynxListAlignment(align: ListAlignment): 'top' | 'middle' | 'bottom' {
  if (align === 'start') return 'top';
  if (align === 'center') return 'middle';
  return 'bottom';
}

/** Imperative adapter around Lynx list methods. It contains no sequence or pagination policy. */
export class LynxListDriver implements BidirectionalListDriver {
  private readonly getNativeId: () => string;
  private readonly getViewportHeight: () => number;
  private readonly getMountedKeys: () => readonly string[];
  private readonly layoutTimeoutMs: number;
  private readonly completedLayouts = new Set<number>();
  private readonly layoutWaiters = new Map<number, {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  constructor(options: LynxListDriverOptions) {
    if (!options.id && !options.getNativeId) {
      throw new Error('LynxListDriver requires id or getNativeId');
    }
    this.getNativeId = options.getNativeId ?? (() => options.id!);
    this.getViewportHeight = options.getViewportHeight;
    this.getMountedKeys = options.getMountedKeys;
    this.layoutTimeoutMs = options.layoutTimeoutMs ?? 1_200;
  }

  async getViewport(): Promise<ListViewportMeasurement> {
    return { start: 0, end: Math.max(0, this.getViewportHeight()) };
  }

  async getVisibleCells(): Promise<readonly ListCellMeasurement[]> {
    const result = await this.invoke('getVisibleCells');
    return this.normalizeCells(cellsFromResult(objectFromResult(result)));
  }

  async getScrollInfo(): Promise<ListScrollMeasurement> {
    const result = objectFromResult(await this.invoke('getScrollInfo'));
    const scrollTop = Number(result?.scrollY);
    const listHeight = Math.max(0, this.getViewportHeight());
    const legacyContentSize = Number(result?.scrollRange);
    const explicitMaxScroll = Number(result?.maxScrollOffset);
    // PITFALL (defensive): prefer the unambiguous `maxScrollOffset`. Older
    // `scrollRange` payloads have behaved like content extent, so the fallback
    // subtracts the viewport. Keep this assumption isolated and covered by
    // adapter tests if the host SDK changes its contract.
    const maxScroll = Number.isFinite(explicitMaxScroll)
      ? Math.max(0, explicitMaxScroll)
      : Number.isFinite(legacyContentSize)
        ? Math.max(0, legacyContentSize - listHeight)
        : Number.NaN;
    if (!Number.isFinite(scrollTop) || !Number.isFinite(maxScroll)) {
      throw new Error('Lynx list getScrollInfo returned incomplete scroll geometry');
    }
    return {
      scrollTop: Math.max(0, scrollTop),
      scrollHeight: maxScroll + listHeight,
      listHeight,
      maxScroll,
    };
  }

  async scrollTo(input: {
    key: string;
    align: ListAlignment;
    offset?: number;
    smooth?: boolean;
  }): Promise<void> {
    const position = this.getMountedKeys().indexOf(input.key);
    if (position < 0) throw new Error(`Cannot scroll to unmounted item ${input.key}`);
    // The method callback means the command was accepted; it does *not* prove
    // that layout/scroll geometry has reached this target. Engine verification
    // and the follow-settlement signal perform that second half.
    await this.invoke('scrollToPosition', {
      position,
      itemKey: input.key,
      alignTo: lynxListAlignment(input.align),
      offset: input.offset ?? 0,
      smooth: input.smooth ?? false,
    });
  }

  waitForLayout(transactionId: number): Promise<void> {
    if (this.completedLayouts.delete(transactionId)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.layoutWaiters.delete(transactionId);
        reject(new Error(`Lynx list layout timed out for transaction ${transactionId}`));
      }, this.layoutTimeoutMs);
      this.layoutWaiters.set(transactionId, { resolve, reject, timer });
    });
  }

  notifyLayoutComplete(transactionId: number): void {
    const waiter = this.layoutWaiters.get(transactionId);
    if (!waiter) {
      this.completedLayouts.add(transactionId);
      return;
    }
    clearTimeout(waiter.timer);
    this.layoutWaiters.delete(transactionId);
    waiter.resolve();
  }

  dispose(): void {
    for (const waiter of this.layoutWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Lynx list driver disposed'));
    }
    this.layoutWaiters.clear();
    this.completedLayouts.clear();
  }

  normalizeCells(cells: readonly NativeListCell[]): ListCellMeasurement[] {
    // Stable unique keys are part of the public contract. Native cell positions
    // are mapped back to supplied data through `item-key`; index-only identity
    // would make prepend anchor restoration ambiguous.
    const indices = new Map(this.getMountedKeys().map((key, index) => [key, index]));
    const normalized: ListCellMeasurement[] = [];
    for (const cell of cells) {
      const key = cell.itemKey ?? cell['item-key'];
      const index = key === undefined ? undefined : indices.get(key);
      if (
        typeof key !== 'string'
        || index === undefined
        || typeof cell.top !== 'number'
        || typeof cell.bottom !== 'number'
      ) continue;
      normalized.push({ key, index, top: cell.top, bottom: cell.bottom });
    }
    return normalized.sort((a, b) => a.index - b.index);
  }

  private invoke(method: string, params?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        lynx.createSelectorQuery()
          // A remounted native List must have a new selector identity. Lynx
          // can keep the old native node registered briefly (and, on macOS,
          // sometimes indefinitely), so querying a reused id may return the
          // previous generation's scroll metrics and an empty cell set.
          .select(`#${this.getNativeId()}`)
          .invoke({
            method,
            ...(params ? { params } : {}),
            success: (result: any) => resolve(result),
            fail: (error: any) => reject(new Error(
              `Lynx list ${method} failed${error ? `: ${String(error?.message ?? error)}` : ''}`,
            )),
          })
          .exec();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
