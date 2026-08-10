import { describe, expect, it } from 'vitest';
import type { ListEventSource, ListScrollState } from '@lynx-js/types';
import { ListSignalMachine } from './signal-machine';
import type { NormalizedNativeListSignal } from './types';

function geometry(input: {
  scrollTop: number;
  maxScroll: number;
  firstCellIndex?: number;
  lastCellIndex?: number;
  eventSource?: ListEventSource;
  trigger?: 'scroll' | 'scrolltoupper' | 'scrolltolower' | 'query';
  queryReason?: 'content-settled' | 'position-verification';
}): Extract<NormalizedNativeListSignal, { type: 'geometry' }> {
  const listHeight = 300;
  return {
    type: 'geometry',
    trigger: input.trigger ?? 'scroll',
    ...(input.queryReason ? { queryReason: input.queryReason } : {}),
    eventSource: input.eventSource ?? 2,
    geometry: {
      scrollTop: input.scrollTop,
      scrollHeight: input.maxScroll + listHeight,
      listHeight,
      maxScroll: input.maxScroll,
      distanceToStart: Math.max(0, input.scrollTop),
      distanceToEnd: Math.max(0, input.maxScroll - input.scrollTop),
      atStart: input.scrollTop <= 0.5,
      atEnd: input.maxScroll - input.scrollTop <= 0.5,
    },
    firstCellIndex: input.firstCellIndex ?? 0,
    lastCellIndex: input.lastCellIndex ?? 2,
    cellCount: (input.lastCellIndex ?? 2) - (input.firstCellIndex ?? 0) + 1,
  };
}

function state(value: number): NormalizedNativeListSignal {
  return { type: 'scrollstatechange', state: value as ListScrollState };
}

describe('ListSignalMachine viewport truth', () => {
  it('reports exact and near boundaries from pixel geometry', () => {
    const machine = new ListSignalMachine({ nearThresholdPx: { start: 120, end: 80 } });

    machine.observe(geometry({ scrollTop: 121, maxScroll: 500 }));
    expect(machine.getSnapshot()).toMatchObject({
      start: { known: true, at: false, near: false, distancePx: 121 },
      end: { known: true, at: false, near: false, distancePx: 379 },
    });

    machine.observe(geometry({ scrollTop: 420, maxScroll: 500 }));
    expect(machine.getSnapshot()).toMatchObject({
      start: { at: false, near: false },
      end: { at: false, near: true, distancePx: 80 },
    });

    machine.observe(geometry({ scrollTop: 500, maxScroll: 500 }));
    expect(machine.getSnapshot()).toMatchObject({
      start: { at: false, near: false },
      end: { at: true, near: true, distancePx: 0 },
    });
  });

  it('does not treat a native lower callback name as a pixel edge', () => {
    const machine = new ListSignalMachine({ nearThresholdPx: 100 });
    machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 522.2,
      maxScroll: 606,
      firstCellIndex: 4,
      lastCellIndex: 7,
    }));

    expect(machine.getSnapshot().end).toMatchObject({
      known: true,
      at: false,
      near: true,
    });
    expect(machine.getSnapshot().end.distancePx).toBeCloseTo(83.8);
  });

  it('marks an underfilled list as both exact edges', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 0, maxScroll: 0, firstCellIndex: 0, lastCellIndex: 1 }));
    expect(machine.getSnapshot()).toMatchObject({
      start: { at: true, near: true },
      end: { at: true, near: true },
    });
  });

  it('publishes actively queried geometry as a stable query signal', () => {
    const machine = new ListSignalMachine({ nearThresholdPx: 240 });
    const [event] = machine.observe({
      ...geometry({ trigger: 'query', scrollTop: 120, maxScroll: 900 }),
      type: 'geometry',
      trigger: 'query',
      queryReason: 'content-settled',
    });
    expect(event).toMatchObject({
      type: 'viewport-reconciled',
      reason: 'content-settled',
      snapshot: { start: { near: true, distancePx: 120 } },
    });
  });
});

describe('ListSignalMachine user gestures', () => {
  it('emits user-reached only for SCROLL geometry inside a gesture', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 300, maxScroll: 600 }));
    machine.observe(state(2));

    expect(machine.observe(geometry({
      scrollTop: 600,
      maxScroll: 600,
      eventSource: 1,
    })).filter((event) => event.type === 'user-reached-edge')).toEqual([]);

    machine.observe(geometry({ scrollTop: 500, maxScroll: 600, eventSource: 2 }));
    const reached = machine.observe(geometry({ scrollTop: 600, maxScroll: 600, eventSource: 2 }));
    expect(reached).toContainEqual(expect.objectContaining({
      type: 'user-reached-edge',
      edge: 'end',
      gestureId: 1,
    }));

    expect(machine.observe(geometry({
      scrollTop: 600,
      maxScroll: 600,
      eventSource: 2,
    })).filter((event) => event.type === 'user-reached-edge')).toEqual([]);
    machine.observe(state(1));
    expect(machine.getSnapshot()).toMatchObject({ motion: 'idle', userGestureId: undefined });
  });

  it('does not attribute layout geometry to an overlapping user gesture', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 200, maxScroll: 600 }));
    machine.observe(state(2));

    const [layoutViewport] = machine.observe(geometry({
      scrollTop: 600,
      maxScroll: 600,
      eventSource: 1,
    }));
    expect(layoutViewport).toMatchObject({ type: 'viewport' });
    expect(layoutViewport?.snapshot.userGestureId).toBeUndefined();

    const [userViewport] = machine.observe(geometry({
      scrollTop: 500,
      maxScroll: 600,
      eventSource: 2,
    }));
    expect(userViewport?.snapshot.userGestureId).toBe(1);
  });

  it('does not emit merely because a gesture starts at an existing edge', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }));
    machine.observe(state(2));

    expect(machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }))).toHaveLength(1);
    machine.observe(geometry({ scrollTop: 550, maxScroll: 600 }));
    const returned = machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }));
    expect(returned).toContainEqual(expect.objectContaining({
      type: 'user-reached-edge',
      edge: 'end',
    }));
  });

  it('keeps the user gesture active through deceleration and ends it on STOP', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 200, maxScroll: 600 }));
    machine.observe(state(2));
    machine.observe(state(3));
    expect(machine.getSnapshot()).toMatchObject({ motion: 'decelerating', userGestureId: 1 });
    machine.observe(state(1));
    expect(machine.getSnapshot()).toMatchObject({ motion: 'idle', userGestureId: undefined });
  });

  it('emits once when a gesture starts at an edge and continues toward it', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }));
    machine.observe(state(2));

    const first = machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 600,
      maxScroll: 600,
    }));
    expect(first).toContainEqual(expect.objectContaining({
      type: 'user-repeated-edge',
      edge: 'end',
      gestureId: 1,
    }));
    expect(first).not.toContainEqual(expect.objectContaining({ type: 'user-reached-edge' }));

    expect(machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 600,
      maxScroll: 600,
    }))).not.toContainEqual(expect.objectContaining({ type: 'user-repeated-edge' }));
  });

  it('separates first arrival from a later same-direction edge gesture', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 500, maxScroll: 600 }));
    machine.observe(state(2));

    const arrived = machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 600,
      maxScroll: 600,
    }));
    expect(arrived).toContainEqual(expect.objectContaining({
      type: 'user-reached-edge',
      edge: 'end',
    }));
    expect(arrived).not.toContainEqual(expect.objectContaining({ type: 'user-repeated-edge' }));

    machine.observe(state(1));
    machine.observe(state(2));
    expect(machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 600,
      maxScroll: 600,
    }))).toContainEqual(expect.objectContaining({
      type: 'user-repeated-edge',
      edge: 'end',
      gestureId: 2,
    }));
  });

  it('requires the matching exact edge and a user scroll source', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }));
    machine.observe(state(2));

    expect(machine.observe(geometry({
      trigger: 'scrolltoupper',
      scrollTop: 600,
      maxScroll: 600,
    }))).not.toContainEqual(expect.objectContaining({ type: 'user-repeated-edge' }));
    expect(machine.observe(geometry({
      trigger: 'scrolltolower',
      scrollTop: 600,
      maxScroll: 600,
      eventSource: 1,
    }))).not.toContainEqual(expect.objectContaining({ type: 'user-repeated-edge' }));
  });

  it('does not report reached while still inside the exact-edge tolerance boundary', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 500, maxScroll: 600 }));
    machine.observe(state(2));
    expect(machine.observe(geometry({ scrollTop: 596, maxScroll: 600 })))
      .not.toContainEqual(expect.objectContaining({ type: 'user-reached-edge' }));
    expect(machine.observe(geometry({ scrollTop: 600, maxScroll: 600 })))
      .toContainEqual(expect.objectContaining({ type: 'user-reached-edge', edge: 'end' }));
  });

  it('uses hysteresis so sub-threshold edge jitter cannot re-arm reached', () => {
    const machine = new ListSignalMachine();
    machine.observe(geometry({ scrollTop: 500, maxScroll: 600 }));
    machine.observe(state(2));
    machine.observe(geometry({ scrollTop: 600, maxScroll: 600 }));

    machine.observe(geometry({ scrollTop: 596, maxScroll: 600 }));
    expect(machine.observe(geometry({ scrollTop: 600, maxScroll: 600 })))
      .not.toContainEqual(expect.objectContaining({ type: 'user-reached-edge' }));

    machine.observe(geometry({ scrollTop: 590, maxScroll: 600 }));
    expect(machine.observe(geometry({ scrollTop: 600, maxScroll: 600 })))
      .toContainEqual(expect.objectContaining({ type: 'user-reached-edge', edge: 'end' }));
  });

});

describe('ListSignalMachine append follow', () => {
  it('settles only on reconciled query geometry containing the appended boundary item', async () => {
    const machine = new ListSignalMachine({ followTimeoutMs: 1_000 });
    machine.observe(geometry({ scrollTop: 600, maxScroll: 600, firstCellIndex: 5, lastCellIndex: 7 }));
    let settled = false;
    const waiting = machine.begin({
      transactionId: 9,
      operation: 'append',
      edge: 'end',
      expectedBoundaryIndex: 9,
    }).then(() => { settled = true; });

    machine.observe(geometry({ scrollTop: 600, maxScroll: 800, firstCellIndex: 5, lastCellIndex: 7 }));
    machine.observe(geometry({ scrollTop: 760, maxScroll: 800, firstCellIndex: 7, lastCellIndex: 9 }));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(machine.getSnapshot().pendingFollow?.transactionId).toBe(9);

    const nativeEvents = machine.observe(geometry({
      scrollTop: 800,
      maxScroll: 800,
      firstCellIndex: 7,
      lastCellIndex: 9,
    }));
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(nativeEvents).not.toContainEqual(expect.objectContaining({ type: 'append-follow-settled' }));

    const events = machine.observe(geometry({
      trigger: 'query',
      queryReason: 'position-verification',
      scrollTop: 800,
      maxScroll: 800,
      firstCellIndex: 7,
      lastCellIndex: 9,
    }));
    await waiting;
    expect(events).toContainEqual(expect.objectContaining({
      type: 'append-follow-settled',
      transactionId: 9,
    }));
    expect(machine.getSnapshot().pendingFollow).toBeUndefined();
  });
});
