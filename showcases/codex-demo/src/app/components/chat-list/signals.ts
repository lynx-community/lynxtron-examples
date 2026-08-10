import type { ListSignalEvent } from '../bidirectional-list';

export type EarlierRevealIntent = 'none' | 'local-only' | 'allow-remote';

export interface ChatListSignalDecision {
  followingTail?: boolean;
  earlier: EarlierRevealIntent;
  backgroundEarlier: boolean;
  later: boolean;
}

export function shouldShowTailActivity(input: {
  followingTail: boolean;
  agentResponding: boolean;
  newerContentAvailable: boolean;
}): boolean {
  return !input.followingTail && (input.agentResponding || input.newerContentAvailable);
}

const NO_ACTION: ChatListSignalDecision = {
  earlier: 'none',
  backgroundEarlier: false,
  later: false,
};

/**
 * The complete data-model boundary for ChatList. It intentionally accepts only
 * the list's stable public signal and never a Lynx native event.
 */
export function decideChatListSignal(
  signal: ListSignalEvent,
  tailThresholdPx = 48,
): ChatListSignalDecision {
  if (signal.type === 'viewport-reconciled') {
    // Position verification and recovery are transaction-internal probes.
    // Feeding them into pagination creates a feedback loop: each successful
    // row replacement schedules another fill, while a failed replacement can
    // immediately request the same navigation again. Data loading only reacts
    // to user/settled-content reconciliation.
    if (signal.reason === 'position-verification' || signal.reason === 'recovery') {
      return NO_ACTION;
    }
    const followingTail = signal.reason === 'gesture'
      ? (signal.snapshot.end.distancePx ?? Number.POSITIVE_INFINITY) <= tailThresholdPx
      : undefined;
    return {
      followingTail,
      earlier: signal.snapshot.start.near ? 'allow-remote' : 'none',
      backgroundEarlier: !signal.snapshot.start.near,
      later: false,
    };
  }
  if (signal.type === 'viewport') {
    if (signal.cause !== 'geometry') return NO_ACTION;
    if (signal.snapshot.userGestureId !== undefined) {
      const followingTail = (signal.snapshot.end.distancePx ?? Number.POSITIVE_INFINITY)
        <= tailThresholdPx;
      return {
        followingTail,
        earlier: signal.snapshot.start.near ? 'allow-remote' : 'none',
        backgroundEarlier: false,
        later: signal.snapshot.end.near,
      };
    }
    return {
      earlier: signal.snapshot.start.at && signal.snapshot.end.at ? 'local-only' : 'none',
      backgroundEarlier: false,
      later: false,
    };
  }

  if (signal.type === 'user-reached-edge' || signal.type === 'user-repeated-edge') {
    return signal.edge === 'start'
      ? { earlier: 'allow-remote', backgroundEarlier: false, later: false }
      : { earlier: 'none', backgroundEarlier: false, later: true };
  }

  return NO_ACTION;
}
