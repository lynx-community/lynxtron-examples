export type TimelineRevealPhase =
  | 'idle'
  | 'planning'
  | 'requesting'
  | 'committing'
  | 'restoring'
  | 'verifying';

export interface TimelineRevealIntent {
  anchorItemKey?: string;
  anchorTop: number;
  availableAbove: number;
  userScrollGeneration: number;
}

export interface TimelineRestoreRequest {
  itemKey: string;
  desiredTop: number;
  position?: number;
  fallbacks?: Array<{ itemKey: string; desiredTop: number }>;
  previousFirstId?: string;
  previousVisibleCount?: number;
  waitForLoader?: boolean;
  revealCount: number;
  requestedCount: number;
}

export interface TimelineRevealTransaction {
  id: number;
  intent: TimelineRevealIntent;
  mode?: 'local-batch' | 'remote-page';
  restore?: TimelineRestoreRequest;
}

export interface TimelineRevealState {
  phase: TimelineRevealPhase;
  nextTransactionId: number;
  transaction: TimelineRevealTransaction | null;
  queuedIntent: TimelineRevealIntent | null;
  lastOutcome?: string;
}

export type TimelineRevealEvent =
  | { type: 'REQUEST'; intent: TimelineRevealIntent }
  | {
    type: 'CONFIGURE';
    transactionId: number;
    mode: 'local-batch' | 'remote-page';
    restore: TimelineRestoreRequest;
  }
  | { type: 'REMOTE_RESOLVED'; transactionId: number; loadedCount: number }
  | { type: 'LAYOUT_READY'; transactionId: number }
  | { type: 'RESTORE_APPLIED'; transactionId: number }
  | { type: 'VERIFIED'; transactionId: number }
  | { type: 'USER_SCROLLED'; transactionId: number; userScrollGeneration: number }
  | { type: 'FAIL'; transactionId: number; reason: string }
  | { type: 'RESET' };

export function initialTimelineRevealState(): TimelineRevealState {
  return {
    phase: 'idle',
    nextTransactionId: 1,
    transaction: null,
    queuedIntent: null,
  };
}

function startIntent(
  state: TimelineRevealState,
  intent: TimelineRevealIntent,
  lastOutcome?: string,
): TimelineRevealState {
  return {
    phase: 'planning',
    nextTransactionId: state.nextTransactionId + 1,
    transaction: { id: state.nextTransactionId, intent },
    queuedIntent: null,
    lastOutcome,
  };
}

function settle(state: TimelineRevealState, outcome: string): TimelineRevealState {
  if (state.queuedIntent) return startIntent(state, state.queuedIntent, outcome);
  return {
    ...state,
    phase: 'idle',
    transaction: null,
    queuedIntent: null,
    lastOutcome: outcome,
  };
}

function isCurrent(state: TimelineRevealState, transactionId: number): boolean {
  return state.transaction?.id === transactionId;
}

export function reduceTimelineReveal(
  state: TimelineRevealState,
  event: TimelineRevealEvent,
): TimelineRevealState {
  switch (event.type) {
    case 'REQUEST':
      return state.phase === 'idle'
        ? startIntent(state, event.intent)
        : { ...state, queuedIntent: event.intent };
    case 'CONFIGURE':
      if (state.phase !== 'planning' || !isCurrent(state, event.transactionId)) return state;
      return {
        ...state,
        phase: event.mode === 'remote-page' ? 'requesting' : 'committing',
        transaction: {
          ...state.transaction!,
          mode: event.mode,
          restore: event.restore,
        },
      };
    case 'REMOTE_RESOLVED':
      if (state.phase !== 'requesting' || !isCurrent(state, event.transactionId)) return state;
      return event.loadedCount > 0
        ? { ...state, phase: 'committing' }
        : settle(state, 'empty-page');
    case 'LAYOUT_READY':
      if (state.phase !== 'committing' || !isCurrent(state, event.transactionId)) return state;
      return { ...state, phase: 'restoring' };
    case 'RESTORE_APPLIED':
      if (state.phase !== 'restoring' || !isCurrent(state, event.transactionId)) return state;
      return { ...state, phase: 'verifying' };
    case 'VERIFIED':
      if (state.phase !== 'verifying' || !isCurrent(state, event.transactionId)) return state;
      return settle(state, 'verified');
    case 'USER_SCROLLED':
      if (!isCurrent(state, event.transactionId)) return state;
      if (event.userScrollGeneration === state.transaction!.intent.userScrollGeneration) return state;
      return settle(state, 'user-scrolled');
    case 'FAIL':
      if (!isCurrent(state, event.transactionId)) return state;
      return settle(state, event.reason);
    case 'RESET':
      return {
        phase: 'idle',
        nextTransactionId: state.nextTransactionId,
        transaction: null,
        queuedIntent: null,
        lastOutcome: 'reset',
      };
    default:
      return state;
  }
}

export function timelineRevealStateErrors(state: TimelineRevealState): string[] {
  const errors: string[] = [];
  if (state.phase === 'idle' && state.transaction !== null) {
    errors.push('idle state must not own a transaction');
  }
  if (state.phase === 'idle' && state.queuedIntent !== null) {
    errors.push('idle state must not retain queued demand');
  }
  if (state.phase !== 'idle' && state.transaction === null) {
    errors.push('active state must own exactly one transaction');
  }
  if (state.nextTransactionId < 1 || !Number.isInteger(state.nextTransactionId)) {
    errors.push('next transaction id must be a positive integer');
  }
  if (state.transaction && state.transaction.id >= state.nextTransactionId) {
    errors.push('active transaction id must be lower than next transaction id');
  }
  if (
    state.transaction
    && state.phase !== 'planning'
    && (!state.transaction.mode || !state.transaction.restore)
  ) {
    errors.push('configured phases require mode and restore request');
  }
  if (state.phase === 'requesting' && state.transaction?.mode !== 'remote-page') {
    errors.push('requesting is only valid for a remote transaction');
  }
  return errors;
}
