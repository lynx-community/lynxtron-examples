import { describe, expect, it } from 'vitest';
import {
  initialTimelineRevealState,
  reduceTimelineReveal,
  timelineRevealStateErrors,
  type TimelineRestoreRequest,
  type TimelineRevealEvent,
  type TimelineRevealIntent,
  type TimelineRevealState,
} from './timeline-reveal-machine';

const intent = (generation: number, anchorItemKey = `anchor-${generation}`): TimelineRevealIntent => ({
  anchorItemKey,
  anchorTop: -20.5,
  availableAbove: 3,
  userScrollGeneration: generation,
});

const restore = (itemKey = 'anchor-1'): TimelineRestoreRequest => ({
  itemKey,
  desiredTop: -20.5,
  revealCount: 3,
  requestedCount: 24,
});

function dispatch(state: TimelineRevealState, event: TimelineRevealEvent): TimelineRevealState {
  const next = reduceTimelineReveal(state, event);
  expect(timelineRevealStateErrors(next)).toEqual([]);
  return next;
}

describe('timeline reveal transaction state machine', () => {
  it('runs one local transaction through commit, restore and verification', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(1) });
    expect(state.phase).toBe('planning');
    const id = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: id, mode: 'local-batch', restore: restore(),
    });
    expect(state.phase).toBe('committing');
    state = dispatch(state, { type: 'LAYOUT_READY', transactionId: id });
    expect(state.phase).toBe('restoring');
    state = dispatch(state, { type: 'RESTORE_APPLIED', transactionId: id });
    expect(state.phase).toBe('verifying');
    state = dispatch(state, { type: 'VERIFIED', transactionId: id });
    expect(state).toMatchObject({ phase: 'idle', transaction: null, lastOutcome: 'verified' });
  });

  it('waits for a remote page before committing its window', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(2) });
    const id = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: id, mode: 'remote-page', restore: restore('anchor-2'),
    });
    expect(state.phase).toBe('requesting');
    state = dispatch(state, { type: 'REMOTE_RESOLVED', transactionId: id, loadedCount: 24 });
    expect(state.phase).toBe('committing');
  });

  it('coalesces concurrent demand and promotes only the latest intent after settlement', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(1) });
    const firstId = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: firstId, mode: 'local-batch', restore: restore(),
    });
    state = dispatch(state, { type: 'REQUEST', intent: intent(2) });
    state = dispatch(state, { type: 'REQUEST', intent: intent(3) });
    state = dispatch(state, { type: 'LAYOUT_READY', transactionId: firstId });
    state = dispatch(state, { type: 'RESTORE_APPLIED', transactionId: firstId });
    state = dispatch(state, { type: 'VERIFIED', transactionId: firstId });
    expect(state.phase).toBe('planning');
    expect(state.transaction?.intent).toEqual(intent(3));
    expect(state.transaction?.id).not.toBe(firstId);
    expect(state.queuedIntent).toBeNull();
  });

  it('ignores every callback from an obsolete transaction', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(1) });
    const oldId = state.transaction!.id;
    state = dispatch(state, { type: 'FAIL', transactionId: oldId, reason: 'anchor-not-visible' });
    state = dispatch(state, { type: 'REQUEST', intent: intent(2) });
    const current = state;
    for (const event of [
      { type: 'REMOTE_RESOLVED', transactionId: oldId, loadedCount: 24 },
      { type: 'LAYOUT_READY', transactionId: oldId },
      { type: 'RESTORE_APPLIED', transactionId: oldId },
      { type: 'VERIFIED', transactionId: oldId },
      { type: 'FAIL', transactionId: oldId, reason: 'late-timeout' },
    ] as TimelineRevealEvent[]) {
      state = dispatch(state, event);
      expect(state).toBe(current);
    }
  });

  it('lets a real user scroll cancel restoration without leaving a locked phase', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(7) });
    const id = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: id, mode: 'local-batch', restore: restore('anchor-7'),
    });
    state = dispatch(state, { type: 'LAYOUT_READY', transactionId: id });
    state = dispatch(state, { type: 'USER_SCROLLED', transactionId: id, userScrollGeneration: 8 });
    expect(state).toMatchObject({ phase: 'idle', transaction: null, lastOutcome: 'user-scrolled' });
  });

  it('replays the observed stationary-during-remote-restore failure as two serial transactions', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(6, 'old-anchor') });
    const remoteId = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: remoteId, mode: 'remote-page', restore: restore('old-anchor'),
    });
    state = dispatch(state, { type: 'REMOTE_RESOLVED', transactionId: remoteId, loadedCount: 20 });
    state = dispatch(state, { type: 'REQUEST', intent: intent(6, 'stationary-anchor') });
    state = dispatch(state, { type: 'LAYOUT_READY', transactionId: remoteId });
    state = dispatch(state, { type: 'RESTORE_APPLIED', transactionId: remoteId });
    state = dispatch(state, { type: 'VERIFIED', transactionId: remoteId });
    expect(state.phase).toBe('planning');
    expect(state.transaction?.intent.anchorItemKey).toBe('stationary-anchor');
    const nextId = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: nextId, mode: 'local-batch', restore: restore('stationary-anchor'),
    });
    state = dispatch(state, { type: 'LAYOUT_READY', transactionId: nextId });
    state = dispatch(state, { type: 'RESTORE_APPLIED', transactionId: nextId });
    state = dispatch(state, { type: 'FAIL', transactionId: nextId, reason: 'anchor-not-visible' });
    expect(state).toMatchObject({ phase: 'idle', transaction: null, lastOutcome: 'anchor-not-visible' });
  });

  it('settles an empty remote page and promotes queued demand', () => {
    let state = dispatch(initialTimelineRevealState(), { type: 'REQUEST', intent: intent(1) });
    const id = state.transaction!.id;
    state = dispatch(state, {
      type: 'CONFIGURE', transactionId: id, mode: 'remote-page', restore: restore(),
    });
    state = dispatch(state, { type: 'REQUEST', intent: intent(2) });
    state = dispatch(state, { type: 'REMOTE_RESOLVED', transactionId: id, loadedCount: 0 });
    expect(state.phase).toBe('planning');
    expect(state.transaction?.intent).toEqual(intent(2));
    expect(state.lastOutcome).toBe('empty-page');
  });

  it('remains valid and recoverable under deterministic random event sequences', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      let randomState = seed;
      const random = () => {
        randomState = (randomState * 1664525 + 1013904223) >>> 0;
        return randomState;
      };
      let state = initialTimelineRevealState();
      for (let step = 0; step < 500; step += 1) {
        const currentId = state.transaction?.id ?? 0;
        const id = random() % 4 === 0 ? Math.max(0, currentId - 1) : currentId;
        const generation = random() % 20;
        const events: TimelineRevealEvent[] = [
          { type: 'REQUEST', intent: intent(generation) },
          { type: 'CONFIGURE', transactionId: id, mode: random() % 2 ? 'local-batch' : 'remote-page', restore: restore() },
          { type: 'REMOTE_RESOLVED', transactionId: id, loadedCount: random() % 3 ? 24 : 0 },
          { type: 'LAYOUT_READY', transactionId: id },
          { type: 'RESTORE_APPLIED', transactionId: id },
          { type: 'VERIFIED', transactionId: id },
          { type: 'USER_SCROLLED', transactionId: id, userScrollGeneration: generation },
          { type: 'FAIL', transactionId: id, reason: 'random-failure' },
        ];
        state = dispatch(state, events[random() % events.length]!);
      }
      // At most the active transaction and one coalesced queued intent need draining.
      for (let drain = 0; drain < 2 && state.transaction; drain += 1) {
        state = dispatch(state, {
          type: 'FAIL', transactionId: state.transaction.id, reason: 'test-drain',
        });
      }
      expect(state.phase).toBe('idle');
      expect(state.transaction).toBeNull();
    }
  });
});
