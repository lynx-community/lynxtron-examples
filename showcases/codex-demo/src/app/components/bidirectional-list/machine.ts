import type {
  InsertPositionPolicy,
  ListMutationKind,
  ListTransactionPhase,
} from './types';

export interface ListMutationRequest {
  requestId: number;
  operation: ListMutationKind;
  position: InsertPositionPolicy;
}

export interface ActiveListTransaction extends ListMutationRequest {
  transactionId: number;
}

export interface BidirectionalListMachineState {
  phase: ListTransactionPhase;
  nextTransactionId: number;
  active: ActiveListTransaction | null;
  queue: readonly ListMutationRequest[];
  lastOutcome?: string;
}

export type BidirectionalListMachineEvent =
  | { type: 'ENQUEUE'; request: ListMutationRequest }
  | { type: 'ANCHOR_CAPTURED'; transactionId: number }
  | { type: 'COMMIT_APPLIED'; transactionId: number }
  | { type: 'LAYOUT_READY'; transactionId: number }
  | { type: 'RESTORE_APPLIED'; transactionId: number }
  | { type: 'VERIFIED'; transactionId: number }
  | { type: 'CANCEL'; transactionId: number; reason: string }
  | { type: 'FAIL'; transactionId: number; reason: string }
  | { type: 'RESET' };

export function initialBidirectionalListMachineState(): BidirectionalListMachineState {
  return { phase: 'idle', nextTransactionId: 1, active: null, queue: [] };
}

function begin(
  state: BidirectionalListMachineState,
  request: ListMutationRequest,
  queue: readonly ListMutationRequest[],
  lastOutcome = state.lastOutcome,
): BidirectionalListMachineState {
  return {
    phase: 'capturing-anchor',
    nextTransactionId: state.nextTransactionId + 1,
    active: { ...request, transactionId: state.nextTransactionId },
    queue,
    lastOutcome,
  };
}

function settle(state: BidirectionalListMachineState, outcome: string): BidirectionalListMachineState {
  const [next, ...queue] = state.queue;
  if (next) return begin(state, next, queue, outcome);
  return { ...state, phase: 'idle', active: null, queue: [], lastOutcome: outcome };
}

function isCurrent(state: BidirectionalListMachineState, transactionId: number): boolean {
  return state.active?.transactionId === transactionId;
}

export function reduceBidirectionalListMachine(
  state: BidirectionalListMachineState,
  event: BidirectionalListMachineEvent,
): BidirectionalListMachineState {
  switch (event.type) {
    case 'ENQUEUE':
      return state.phase === 'idle'
        ? begin(state, event.request, [])
        : { ...state, queue: [...state.queue, event.request] };
    case 'ANCHOR_CAPTURED':
      return state.phase === 'capturing-anchor' && isCurrent(state, event.transactionId)
        ? { ...state, phase: 'committing' }
        : state;
    case 'COMMIT_APPLIED':
      return state.phase === 'committing' && isCurrent(state, event.transactionId)
        ? { ...state, phase: 'waiting-layout' }
        : state;
    case 'LAYOUT_READY':
      return state.phase === 'waiting-layout' && isCurrent(state, event.transactionId)
        ? { ...state, phase: 'restoring' }
        : state;
    case 'RESTORE_APPLIED':
      return state.phase === 'restoring' && isCurrent(state, event.transactionId)
        ? { ...state, phase: 'verifying' }
        : state;
    case 'VERIFIED':
      return state.phase === 'verifying' && isCurrent(state, event.transactionId)
        ? settle(state, 'settled')
        : state;
    case 'CANCEL':
      return isCurrent(state, event.transactionId) ? settle(state, `cancelled:${event.reason}`) : state;
    case 'FAIL':
      return isCurrent(state, event.transactionId) ? settle(state, `failed:${event.reason}`) : state;
    case 'RESET':
      return {
        phase: 'idle',
        nextTransactionId: state.nextTransactionId,
        active: null,
        queue: [],
        lastOutcome: 'reset',
      };
    default:
      return state;
  }
}

export function bidirectionalListMachineErrors(state: BidirectionalListMachineState): string[] {
  const errors: string[] = [];
  if (state.phase === 'idle' && state.active) errors.push('idle must not own an active transaction');
  if (state.phase !== 'idle' && !state.active) errors.push('active phase must own one transaction');
  if (state.phase === 'idle' && state.queue.length > 0) errors.push('idle must not retain queued mutations');
  if (!Number.isInteger(state.nextTransactionId) || state.nextTransactionId < 1) {
    errors.push('next transaction id must be a positive integer');
  }
  if (state.active && state.active.transactionId >= state.nextTransactionId) {
    errors.push('active transaction id must precede next transaction id');
  }
  const requestIds = [state.active?.requestId, ...state.queue.map((item) => item.requestId)]
    .filter((value): value is number => value !== undefined);
  if (new Set(requestIds).size !== requestIds.length) errors.push('request ids must be unique');
  return errors;
}
