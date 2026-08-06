import { describe, expect, it } from 'vitest';
import {
  bidirectionalListMachineErrors,
  initialBidirectionalListMachineState,
  reduceBidirectionalListMachine,
  type BidirectionalListMachineEvent,
  type BidirectionalListMachineState,
  type ListMutationRequest,
} from './machine';

function request(requestId: number, operation: ListMutationRequest['operation'] = 'prepend'): ListMutationRequest {
  return { requestId, operation, position: { type: 'preserve' } };
}

function dispatch(
  state: BidirectionalListMachineState,
  event: BidirectionalListMachineEvent,
): BidirectionalListMachineState {
  const next = reduceBidirectionalListMachine(state, event);
  expect(bidirectionalListMachineErrors(next)).toEqual([]);
  return next;
}

function settleActive(state: BidirectionalListMachineState): BidirectionalListMachineState {
  const id = state.active!.transactionId;
  state = dispatch(state, { type: 'ANCHOR_CAPTURED', transactionId: id });
  state = dispatch(state, { type: 'COMMIT_APPLIED', transactionId: id });
  state = dispatch(state, { type: 'LAYOUT_READY', transactionId: id });
  state = dispatch(state, { type: 'RESTORE_APPLIED', transactionId: id });
  return dispatch(state, { type: 'VERIFIED', transactionId: id });
}

describe('BidirectionalList transaction machine', () => {
  it('runs the complete anchor transaction in order', () => {
    let state = dispatch(initialBidirectionalListMachineState(), { type: 'ENQUEUE', request: request(1) });
    expect(state.phase).toBe('capturing-anchor');
    state = settleActive(state);
    expect(state).toMatchObject({ phase: 'idle', active: null, lastOutcome: 'settled' });
  });

  it('keeps every concurrent mutation in FIFO order', () => {
    let state = initialBidirectionalListMachineState();
    state = dispatch(state, { type: 'ENQUEUE', request: request(1) });
    state = dispatch(state, { type: 'ENQUEUE', request: request(2, 'append') });
    state = dispatch(state, { type: 'ENQUEUE', request: request(3, 'update') });
    expect(state.queue.map((entry) => entry.requestId)).toEqual([2, 3]);

    state = settleActive(state);
    expect(state.active?.requestId).toBe(2);
    state = settleActive(state);
    expect(state.active?.requestId).toBe(3);
    state = settleActive(state);
    expect(state.phase).toBe('idle');
  });

  it('ignores late callbacks from obsolete transactions', () => {
    let state = dispatch(initialBidirectionalListMachineState(), { type: 'ENQUEUE', request: request(1) });
    const obsoleteId = state.active!.transactionId;
    state = dispatch(state, { type: 'CANCEL', transactionId: obsoleteId, reason: 'user-scroll' });
    state = dispatch(state, { type: 'ENQUEUE', request: request(2) });
    const current = state;
    for (const event of [
      { type: 'COMMIT_APPLIED', transactionId: obsoleteId },
      { type: 'LAYOUT_READY', transactionId: obsoleteId },
      { type: 'RESTORE_APPLIED', transactionId: obsoleteId },
      { type: 'VERIFIED', transactionId: obsoleteId },
    ] as BidirectionalListMachineEvent[]) {
      expect(dispatch(state, event)).toBe(current);
    }
  });

  it('promotes the next queued mutation after failure', () => {
    let state = dispatch(initialBidirectionalListMachineState(), { type: 'ENQUEUE', request: request(1) });
    state = dispatch(state, { type: 'ENQUEUE', request: request(2) });
    state = dispatch(state, {
      type: 'FAIL', transactionId: state.active!.transactionId, reason: 'layout-timeout',
    });
    expect(state.phase).toBe('capturing-anchor');
    expect(state.active?.requestId).toBe(2);
    expect(state.lastOutcome).toBe('failed:layout-timeout');
  });

  it('remains valid under noisy deterministic event sequences', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let randomState = seed;
      const random = () => (randomState = (randomState * 1664525 + 1013904223) >>> 0);
      let nextRequestId = 1;
      let state = initialBidirectionalListMachineState();
      for (let step = 0; step < 300; step += 1) {
        const currentId = state.active?.transactionId ?? 0;
        const id = random() % 4 === 0 ? Math.max(0, currentId - 1) : currentId;
        const events: BidirectionalListMachineEvent[] = [
          { type: 'ENQUEUE', request: request(nextRequestId++) },
          { type: 'ANCHOR_CAPTURED', transactionId: id },
          { type: 'COMMIT_APPLIED', transactionId: id },
          { type: 'LAYOUT_READY', transactionId: id },
          { type: 'RESTORE_APPLIED', transactionId: id },
          { type: 'VERIFIED', transactionId: id },
          { type: 'CANCEL', transactionId: id, reason: 'user-scroll' },
          { type: 'FAIL', transactionId: id, reason: 'timeout' },
        ];
        state = dispatch(state, events[random() % events.length]!);
      }
      while (state.active) {
        state = dispatch(state, {
          type: 'FAIL', transactionId: state.active.transactionId, reason: 'test-drain',
        });
      }
      expect(state.phase).toBe('idle');
    }
  });
});
