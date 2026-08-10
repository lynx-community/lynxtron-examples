import {
  initialBidirectionalListMachineState,
  reduceBidirectionalListMachine,
  type BidirectionalListMachineState,
  type ListMutationRequest,
} from './machine';
import {
  anchorCorrection,
  firstStableAnchor,
} from './model';
import type {
  AppendFollowSettlement,
  BidirectionalListDriver,
  InsertOptions,
  InsertPositionPolicy,
  ListMutationKind,
  ListTransactionResult,
  PositionReconciler,
  PositionVerificationRequest,
  ReplaceOptions,
} from './types';

const POSITION_RECONCILE_MAX_ATTEMPTS = 3;

interface EngineMutation<T> {
  request: ListMutationRequest;
  apply: (items: readonly T[]) => {
    items: readonly T[];
    insertedKeys?: readonly string[];
  };
  resolve: (result: ListTransactionResult) => void;
}

export interface BidirectionalListEngineOptions<T> {
  initialItems: readonly T[];
  getItemKey: (item: T) => string;
  driver: BidirectionalListDriver;
  onCommit: (state: {
    items: readonly T[];
    transactionId: number;
  }) => void;
  onSettled?: (result: ListTransactionResult) => void;
  appendFollowSettlement?: AppendFollowSettlement;
  positionReconciler?: PositionReconciler;
}

/** Headless mutation/anchoring engine shared by the Lynx adapter and deterministic tests. */
export class BidirectionalListEngine<T> {
  private items: readonly T[];
  private readonly getItemKey: (item: T) => string;
  private readonly driver: BidirectionalListDriver;
  private readonly onCommit: BidirectionalListEngineOptions<T>['onCommit'];
  private readonly onSettled?: BidirectionalListEngineOptions<T>['onSettled'];
  private readonly appendFollowSettlement?: AppendFollowSettlement;
  private readonly positionReconciler?: PositionReconciler;
  private machine: BidirectionalListMachineState = initialBidirectionalListMachineState();
  private nextRequestId = 1;
  private readonly mutations = new Map<number, EngineMutation<T>>();
  private pumping = false;

  constructor(options: BidirectionalListEngineOptions<T>) {
    this.items = [...options.initialItems];
    this.getItemKey = options.getItemKey;
    this.driver = options.driver;
    this.onCommit = options.onCommit;
    this.onSettled = options.onSettled;
    this.appendFollowSettlement = options.appendFollowSettlement;
    this.positionReconciler = options.positionReconciler;
    this.assertUniqueKeys(this.items);
  }

  getItems(): readonly T[] {
    return this.items;
  }

  getMachineState(): BidirectionalListMachineState {
    return this.machine;
  }

  prepend(items: readonly T[], options: InsertOptions = {}): Promise<ListTransactionResult> {
    const inserted = [...items];
    return this.enqueue('prepend', options.position, (current) => {
      const next = [...inserted, ...current];
      this.assertUniqueKeys(next);
      return { items: next, insertedKeys: inserted.map(this.getItemKey) };
    });
  }

  append(items: readonly T[], options: InsertOptions = {}): Promise<ListTransactionResult> {
    const inserted = [...items];
    return this.enqueue('append', options.position, (current) => {
      const next = [...current, ...inserted];
      this.assertUniqueKeys(next);
      return { items: next, insertedKeys: inserted.map(this.getItemKey) };
    });
  }

  update(key: string, updater: T | ((current: T) => T)): Promise<ListTransactionResult> {
    return this.enqueue('update', { type: 'preserve' }, (current) => {
      const index = current.findIndex((item) => this.getItemKey(item) === key);
      if (index < 0) throw new Error(`Unknown item key: ${key}`);
      const next = [...current];
      next[index] = typeof updater === 'function'
        ? (updater as (item: T) => T)(current[index]!)
        : updater;
      this.assertUniqueKeys(next);
      return { items: next };
    });
  }

  replace(items: readonly T[], options: ReplaceOptions = {}): Promise<ListTransactionResult> {
    const replacement = [...items];
    const requestedPosition = options.position ?? 'preserve';
    const targetKey = typeof requestedPosition === 'object'
      ? requestedPosition.key
      : requestedPosition === 'start'
        ? replacement[0] && this.getItemKey(replacement[0])
        : requestedPosition === 'end'
          ? replacement.at(-1) && this.getItemKey(replacement.at(-1)!)
          : undefined;
    const policy: InsertPositionPolicy = requestedPosition === 'preserve'
      ? { type: 'preserve' }
      : {
        type: 'follow-insert',
        target: 'first',
        align: typeof requestedPosition === 'object'
          ? requestedPosition.align ?? 'start'
          : requestedPosition,
      };
    return this.enqueue('replace', policy, () => {
      this.assertUniqueKeys(replacement);
      if (targetKey && !replacement.some((item) => this.getItemKey(item) === targetKey)) {
        throw new Error(`Unknown replace position key: ${targetKey}`);
      }
      return {
        items: replacement,
        insertedKeys: targetKey ? [targetKey] : [],
      };
    });
  }

  reset(
    items: readonly T[],
    options: { position?: 'start' | 'end' | { key: string; align?: 'start' | 'center' | 'end' } } = {},
  ): Promise<ListTransactionResult> {
    const replacement = [...items];
    const requestedPosition = options.position ?? 'end';
    const targetKey = typeof requestedPosition === 'object'
      ? requestedPosition.key
      : requestedPosition === 'start'
        ? replacement[0] && this.getItemKey(replacement[0])
        : replacement.at(-1) && this.getItemKey(replacement.at(-1)!);
    const policy: InsertPositionPolicy = {
      type: 'follow-insert',
      target: 'first',
      align: typeof requestedPosition === 'object'
        ? requestedPosition.align ?? 'start'
        : requestedPosition,
    };
    return this.enqueue('reset', policy, () => {
      this.assertUniqueKeys(replacement);
      if (targetKey && !replacement.some((item) => this.getItemKey(item) === targetKey)) {
        throw new Error(`Unknown reset position key: ${targetKey}`);
      }
      return {
        items: replacement,
        insertedKeys: targetKey ? [targetKey] : [],
      };
    });
  }

  navigateTo(
    key: string,
    options: { align?: 'start' | 'center' | 'end'; smooth?: boolean } = {},
  ): Promise<ListTransactionResult> {
    const align = options.align ?? 'center';
    return this.enqueue(
      'navigate',
      { type: 'follow-insert', target: 'first', align, smooth: options.smooth },
      (current) => {
        const index = current.findIndex((item) => this.getItemKey(item) === key);
        if (index < 0) throw new Error(`Unknown item key: ${key}`);
        return {
          items: current,
          insertedKeys: [key],
        };
      },
    );
  }

  private enqueue(
    operation: ListMutationKind,
    position: InsertPositionPolicy = { type: 'preserve' },
    apply: EngineMutation<T>['apply'],
  ): Promise<ListTransactionResult> {
    const request: ListMutationRequest = { requestId: this.nextRequestId++, operation, position };
    const promise = new Promise<ListTransactionResult>((resolve) => {
      this.mutations.set(request.requestId, { request, apply, resolve });
    });
    this.machine = reduceBidirectionalListMachine(this.machine, { type: 'ENQUEUE', request });
    void this.pump();
    return promise;
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.machine.active) {
        const active = this.machine.active;
        const mutation = this.mutations.get(active.requestId);
        if (!mutation) throw new Error(`Missing mutation request ${active.requestId}`);
        const result = await this.execute(active.transactionId, mutation);
        this.mutations.delete(active.requestId);
        mutation.resolve(result);
        this.onSettled?.(result);
      }
    } finally {
      this.pumping = false;
      if (this.machine.active) void this.pump();
    }
  }

  private async execute(
    transactionId: number,
    mutation: EngineMutation<T>,
  ): Promise<ListTransactionResult> {
    let appendFollowStarted = false;
    try {
      const viewport = await this.driver.getViewport();
      const anchor = firstStableAnchor(await this.driver.getVisibleCells(), viewport.start);
      this.dispatch({ type: 'ANCHOR_CAPTURED', transactionId });
      const next = mutation.apply(this.items);
      this.items = next.items;
      const policy = mutation.request.position;
      const appendFollowsEnd = mutation.request.operation === 'append'
        && policy.type === 'follow-insert'
        && Boolean(next.insertedKeys?.length)
        && policy.target !== 'first'
        && (policy.align ?? 'end') === 'end';
      const appendFollowPromise = appendFollowsEnd && this.appendFollowSettlement
        ? this.appendFollowSettlement.begin({
          transactionId,
          operation: 'append',
          edge: 'end',
          expectedBoundaryIndex: Math.max(0, this.items.length - 1),
        })
        : undefined;
      // The promise is awaited below; attach a handler immediately so an
      // earlier driver failure followed by cancellation cannot report an
      // unhandled rejection in the host runtime.
      void appendFollowPromise?.catch(() => {});
      appendFollowStarted = appendFollowPromise !== undefined;
      this.onCommit({ items: this.items, transactionId });
      this.dispatch({ type: 'COMMIT_APPLIED', transactionId });
      await this.driver.waitForLayout(transactionId);
      this.dispatch({ type: 'LAYOUT_READY', transactionId });

      let targetKey: string | undefined;
      let desiredTop = viewport.start;
      let align: 'start' | 'center' | 'end' = 'start';
      let smooth = false;
      if (policy.type === 'follow-insert' && next.insertedKeys?.length) {
        targetKey = policy.target === 'first'
          ? next.insertedKeys[0]
          : next.insertedKeys[next.insertedKeys.length - 1];
        align = policy.align ?? (mutation.request.operation === 'prepend' ? 'start' : 'end');
        smooth = policy.smooth ?? false;
      } else if (anchor && this.items.some((item) => this.getItemKey(item) === anchor.key)) {
        targetKey = anchor.key;
        desiredTop = anchor.top;
      }

      if (targetKey) {
        const targetIndex = this.items.findIndex((item) => this.getItemKey(item) === targetKey);
        const verification: PositionVerificationRequest = {
          transactionId,
          operation: mutation.request.operation,
          targetKey,
          targetIndex,
          align,
          expectedTop: desiredTop,
        };
        let matched = false;
        let recovered = false;
        for (let attempt = 1; attempt <= POSITION_RECONCILE_MAX_ATTEMPTS; attempt += 1) {
          await this.driver.scrollTo({ key: targetKey, align, offset: desiredTop, smooth });
          if (!this.positionReconciler) {
            matched = true;
            break;
          }
          const outcome = await this.positionReconciler.verify(verification);
          if (outcome === 'matched') {
            matched = true;
            break;
          }
          // A stable-but-wrong attachment can retain non-empty cells from an
          // older layout generation, so cellCount alone cannot identify every
          // broken native state. After one ordinary retry, remount once for
          // either a detached viewport or a persistent stable mismatch.
          if (!recovered && (outcome === 'detached' || attempt === 2)) {
            await this.positionReconciler.recover(verification);
            recovered = true;
          }
        }
        if (!matched) {
          throw new Error(`Position reconciliation failed for ${targetKey}`);
        }
      }
      this.dispatch({ type: 'RESTORE_APPLIED', transactionId });

      // PITFALL (observed): the native method callback only confirms command
      // acceptance. A followed append is complete only when the signal layer
      // observes *newer* exact-end geometry containing the appended boundary
      // item; otherwise an old at-end sample can settle the wrong transaction.
      if (appendFollowPromise) await appendFollowPromise;

      let anchorErrorPx = 0;
      if (targetKey && policy.type === 'preserve') {
        const restored = (await this.driver.getVisibleCells()).find((cell) => cell.key === targetKey);
        if (!restored) throw new Error(`Anchor ${targetKey} is not visible after restoration`);
        anchorErrorPx = anchorCorrection(restored.top, desiredTop);
        if (Math.abs(anchorErrorPx) > 1) {
          await this.driver.scrollTo({ key: targetKey, align: 'start', offset: desiredTop });
          const verified = (await this.driver.getVisibleCells()).find((cell) => cell.key === targetKey);
          if (!verified) throw new Error(`Anchor ${targetKey} disappeared during verification`);
          anchorErrorPx = anchorCorrection(verified.top, desiredTop);
        }
      }
      this.dispatch({ type: 'VERIFIED', transactionId });
      return { id: transactionId, operation: mutation.request.operation, outcome: 'settled', anchorErrorPx };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (appendFollowStarted) this.appendFollowSettlement?.cancel(transactionId, reason);
      this.dispatch({ type: 'FAIL', transactionId, reason });
      return { id: transactionId, operation: mutation.request.operation, outcome: 'failed', reason };
    }
  }

  private dispatch(event: Parameters<typeof reduceBidirectionalListMachine>[1]): void {
    this.machine = reduceBidirectionalListMachine(this.machine, event);
  }

  private assertUniqueKeys(items: readonly T[]): void {
    const keys = items.map(this.getItemKey);
    if (new Set(keys).size !== keys.length) throw new Error('BidirectionalList item keys must be unique');
  }
}
