import { describe, expect, it } from 'vitest';
import type { ListSignalEvent, ListSignalSnapshot } from '../bidirectional-list';
import { decideChatListSignal, shouldShowTailActivity } from './signals';

function snapshot(overrides: Partial<ListSignalSnapshot> = {}): ListSignalSnapshot {
  return {
    revision: 1,
    motion: 'idle',
    start: { known: true, at: false, near: false, distancePx: 500 },
    end: { known: true, at: false, near: false, distancePx: 500 },
    cellCount: 3,
    ...overrides,
  };
}

function viewport(value: ListSignalSnapshot): ListSignalEvent {
  return { type: 'viewport', cause: 'geometry', snapshot: value };
}

function query(value: ListSignalSnapshot): ListSignalEvent {
  return { type: 'viewport', cause: 'query', queryReason: 'content-settled', snapshot: value };
}

describe('ChatList stable signal boundary', () => {
  it('allows non-user geometry to fill local underflow but never request remote data', () => {
    expect(decideChatListSignal(viewport(snapshot({
      start: { known: true, at: true, near: true, distancePx: 0 },
      end: { known: true, at: true, near: true, distancePx: 0 },
    })))).toEqual({ earlier: 'local-only', backgroundEarlier: false, later: false });
  });

  it('uses user-backed near state to maintain both progressive buffers', () => {
    expect(decideChatListSignal(viewport(snapshot({
      userGestureId: 7,
      start: { known: true, at: false, near: true, distancePx: 120 },
      end: { known: true, at: false, near: false, distancePx: 900 },
    })))).toEqual({ followingTail: false, earlier: 'allow-remote', backgroundEarlier: false, later: false });
  });

  it('tracks tail following from the encapsulated distance state', () => {
    expect(decideChatListSignal(viewport(snapshot({
      userGestureId: 8,
      end: { known: true, at: false, near: true, distancePx: 24 },
    })))).toEqual({ followingTail: true, earlier: 'none', backgroundEarlier: false, later: true });
  });

  it('turns a repeated start gesture into an explicit remote-capable intent', () => {
    expect(decideChatListSignal({
      type: 'user-repeated-edge',
      edge: 'start',
      gestureId: 9,
      snapshot: snapshot(),
    })).toEqual({ earlier: 'allow-remote', backgroundEarlier: false, later: false });
  });

  it('continues immediately after a settled batch while the active query is still near start', () => {
    expect(decideChatListSignal(query(snapshot({
      start: { known: true, at: false, near: true, distancePx: 140 },
    })))).toEqual({
      followingTail: undefined,
      earlier: 'allow-remote',
      backgroundEarlier: false,
      later: false,
    });
  });

  it('requests debounced background fill when a settled viewport is no longer near start', () => {
    expect(decideChatListSignal(query(snapshot()))).toEqual({
      followingTail: undefined,
      earlier: 'none',
      backgroundEarlier: true,
      later: false,
    });
  });
});

describe('ChatList tail activity indicator', () => {
  it('shows animated activity while the agent responds away from tail', () => {
    expect(shouldShowTailActivity({
      followingTail: false,
      agentResponding: true,
      newerContentAvailable: false,
    })).toBe(true);
  });

  it('stays visible for unread content and hides after returning to tail', () => {
    expect(shouldShowTailActivity({
      followingTail: false,
      agentResponding: false,
      newerContentAvailable: true,
    })).toBe(true);
    expect(shouldShowTailActivity({
      followingTail: true,
      agentResponding: true,
      newerContentAvailable: true,
    })).toBe(false);
  });
});
