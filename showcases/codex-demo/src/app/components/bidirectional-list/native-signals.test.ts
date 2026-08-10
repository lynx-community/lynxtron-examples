import { describe, expect, it } from 'vitest';
import type {
  ListAttachedCell,
  ListLayoutCompleteEvent,
  ListScrollEvent,
  ListScrollInfo,
  ListScrollStateChangeEvent,
  ListScrollToLowerEvent,
} from '@lynx-js/types';
import {
  NativeListSignalNormalizer,
  parseNativeListSignal,
} from './native-signals';
import type { ListCellMeasurement, NativeListSignal } from './types';

function cell(index: number, top: number, bottom: number): ListAttachedCell {
  return {
    id: String(index),
    itemKey: `item-${index}`,
    index,
    left: 0,
    right: 300,
    top,
    bottom,
  };
}

function scrollInfo(overrides: Partial<ListScrollInfo> = {}): ListScrollInfo {
  return {
    deltaX: 0,
    deltaY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 300,
    scrollHeight: 900,
    listWidth: 300,
    listHeight: 300,
    eventSource: 2,
    attachedCells: [],
    ...overrides,
  };
}

function normalize(cells: readonly ListAttachedCell[]): readonly ListCellMeasurement[] {
  return cells.map((item) => ({
    key: item.itemKey,
    index: item.index,
    top: item.top,
    bottom: item.bottom,
  }));
}

function rawGeometry(
  type: 'layoutcomplete' | 'scroll' | 'scrolltoupper' | 'scrolltolower',
  eventSource: number,
  scrollTop: number,
  maxScroll: number,
  firstCellIndex = 0,
  lastCellIndex = 2,
): NativeListSignal {
  return {
    type,
    eventSource,
    scrollTop,
    scrollHeight: maxScroll + 300,
    listHeight: 300,
    maxScroll,
    firstCellIndex,
    lastCellIndex,
    firstCellTop: 0,
    lastCellBottom: 300,
    cellCount: lastCellIndex - firstCellIndex + 1,
  };
}

describe('parseNativeListSignal', () => {
  it('reads layoutcomplete metrics from the official detail.scrollInfo envelope', () => {
    const event = {
      detail: {
        scrollInfo: scrollInfo({
          eventSource: 0,
          scrollTop: 240,
          attachedCells: [cell(2, -20, 80), cell(3, 80, 180)],
        }),
      },
    } as unknown as ListLayoutCompleteEvent;
    const signal = parseNativeListSignal('layoutcomplete', event, normalize);

    expect(signal).toEqual({
      type: 'layoutcomplete',
      eventSource: 0,
      state: undefined,
      scrollTop: 240,
      scrollHeight: 900,
      listHeight: 300,
      maxScroll: 600,
      firstCellIndex: 2,
      lastCellIndex: 3,
      firstCellTop: -20,
      lastCellBottom: 180,
      cellCount: 2,
    });
  });

  it('reads direct scroll payloads without changing their source', () => {
    const event = {
      detail: scrollInfo({
        eventSource: 2,
        scrollTop: 600,
        attachedCells: [cell(8, 200, 300)],
      }),
    } as unknown as ListScrollToLowerEvent;
    const signal = parseNativeListSignal('scrolltolower', event, normalize);

    expect(signal.eventSource).toBe(2);
    expect(signal.scrollTop).toBe(600);
    expect(signal.maxScroll).toBe(600);
    expect(signal.firstCellIndex).toBe(8);
    expect(signal.lastCellIndex).toBe(8);
  });

  it('keeps scroll state events metric-free', () => {
    const event = { detail: { state: 2 } } as unknown as ListScrollStateChangeEvent;
    expect(parseNativeListSignal('scrollstatechange', event, normalize)).toEqual({
      type: 'scrollstatechange',
      eventSource: undefined,
      state: 2,
      scrollTop: undefined,
      scrollHeight: undefined,
      listHeight: undefined,
      maxScroll: undefined,
      firstCellIndex: undefined,
      lastCellIndex: undefined,
      firstCellTop: undefined,
      lastCellBottom: undefined,
      cellCount: 0,
    });
  });

  it('clamps maxScroll for underfilled lists', () => {
    const event = {
      detail: scrollInfo({ scrollHeight: 180, listHeight: 300 }),
    } as unknown as ListScrollEvent;
    expect(parseNativeListSignal('scroll', event, normalize).maxScroll).toBe(0);
  });
});

describe('NativeListSignalNormalizer', () => {
  it('drops transient DIFF geometry but preserves an exact user boundary signal', () => {
    const normalizer = new NativeListSignalNormalizer();

    expect(normalizer.observe(rawGeometry('layoutcomplete', 0, 0, 606))).toEqual([]);
    expect(normalizer.observe(rawGeometry('scrolltoupper', 0, 0, 606))).toEqual([]);

    const [bottom] = normalizer.observe(rawGeometry('scroll', 1, 606, 606, 5, 7));
    expect(bottom).toMatchObject({
      type: 'geometry',
      trigger: 'scroll',
      eventSource: 1,
      geometry: { atStart: false, atEnd: true, distanceToEnd: 0 },
    });

    expect(normalizer.observe(rawGeometry('scrolltolower', 2, 606, 606, 5, 7)))
      .toEqual([expect.objectContaining({
        type: 'geometry',
        trigger: 'scrolltolower',
        eventSource: 2,
        geometry: expect.objectContaining({ atEnd: true }),
      })]);
  });

  it('still de-duplicates equal ordinary scroll geometry', () => {
    const normalizer = new NativeListSignalNormalizer();
    expect(normalizer.observe(rawGeometry('scroll', 2, 600, 600, 5, 7))).toHaveLength(1);
    expect(normalizer.observe(rawGeometry('scroll', 2, 600, 600, 5, 7))).toEqual([]);
  });

  it('ignores a transient upper signal before an append-follow lower signal', () => {
    const normalizer = new NativeListSignalNormalizer();

    expect(normalizer.observe(rawGeometry('scrolltoupper', 0, 0, 1338, 0, 2))).toEqual([]);
    const [bottom] = normalizer.observe(rawGeometry('scrolltolower', 1, 1338, 1338, 11, 13));
    expect(bottom).toMatchObject({
      type: 'geometry',
      trigger: 'scrolltolower',
      geometry: { atStart: false, atEnd: true },
    });
  });

  it('normalizes an underfilled viewport as both edges and de-duplicates the second callback', () => {
    const normalizer = new NativeListSignalNormalizer();
    const [underfill] = normalizer.observe(rawGeometry('scrolltoupper', 2, 0, 0, 0, 1));

    expect(underfill).toMatchObject({
      type: 'geometry',
      geometry: { atStart: true, atEnd: true, distanceToStart: 0, distanceToEnd: 0 },
    });
    expect(normalizer.observe(rawGeometry('scrolltolower', 1, 0, 0, 0, 1))).toEqual([]);
  });

  it('keeps scroll state independent and de-duplicates repeated states', () => {
    const normalizer = new NativeListSignalNormalizer();
    const dragging: NativeListSignal = { type: 'scrollstatechange', state: 2, cellCount: 0 };
    const stopped: NativeListSignal = { type: 'scrollstatechange', state: 1, cellCount: 0 };

    expect(normalizer.observe(dragging)).toEqual([{ type: 'scrollstatechange', state: 2 }]);
    expect(normalizer.observe(dragging)).toEqual([]);
    expect(normalizer.observe(stopped)).toEqual([{ type: 'scrollstatechange', state: 1 }]);
  });
});
