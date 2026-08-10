import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../shared/agent';
import {
  anchorCorrectionOffset,
  attachedCellsFromResult,
  estimateTimelineItemHeight,
  findTimelineAnchor,
  historyLoaderTransition,
  latestTimelineWindow,
  isTerminalRevealPhase,
  planEarlierReveal,
  resolveTimelineAnchor,
  revealCountForRemotePage,
  rebaseTimelineWindowAfterPrepend,
  shiftTimelineWindowEarlier,
  shiftTimelineWindowLater,
  shouldRestoreAnchor,
  shouldChainRemoteReveal,
  TimelineHeightCache,
  timelineWindowSize,
  timelineLayoutId,
  timelineListPosition,
} from './timeline-window';

const item = (id: string, text = id): TimelineEntry => ({
  id,
  sequence: Number(id.replace(/\D/g, '')) || 0,
  kind: 'assistant',
  text,
});

describe('bounded bidirectional timeline window', () => {
  it('starts with three items, grows progressively, and caps the default window at 500', () => {
    let window = latestTimelineWindow(1_200);
    expect(timelineWindowSize(window)).toBe(3);

    window = shiftTimelineWindowEarlier(window, 6, 1_200);
    expect(timelineWindowSize(window)).toBe(9);

    for (let index = 0; index < 100; index += 1) {
      window = shiftTimelineWindowEarlier(window, 6, 1_200);
      expect(timelineWindowSize(window)).toBeLessThanOrEqual(500);
    }
    expect(timelineWindowSize(window)).toBe(500);
  });

  it('never grows past the mounted-item cap during a long upward traversal', () => {
    let window = latestTimelineWindow(500);
    for (let index = 0; index < 100; index += 1) {
      window = shiftTimelineWindowEarlier(window, 3, 500, 36);
      expect(timelineWindowSize(window)).toBeLessThanOrEqual(36);
    }
    expect(window).toEqual({ start: 197, end: 233 });
  });

  it('can traverse back toward the tail without increasing the mounted window', () => {
    let window = { start: 80, end: 116 };
    for (let index = 0; index < 40; index += 1) {
      window = shiftTimelineWindowLater(window, 3, 200, 36);
      expect(timelineWindowSize(window)).toBeLessThanOrEqual(36);
    }
    expect(window).toEqual({ start: 164, end: 200 });
  });

  it('rebases indices after a remote prepend while retaining a bounded older slice', () => {
    expect(rebaseTimelineWindowAfterPrepend(
      { start: 0, end: 36 },
      24,
      4,
      124,
      36,
    )).toEqual({ start: 20, end: 56 });
  });
});

describe('timeline anchor preservation', () => {
  it('prefers the first fully visible cell so verification cannot lose a clipped anchor', () => {
    const items = [item('1'), item('2'), item('3')];
    const anchor = findTimelineAnchor([
      { itemKey: '2', top: 84 },
      { itemKey: '1', top: -27 },
    ], items);
    expect(anchor).toEqual({ itemKey: '2', index: 1, top: 84 });
    expect(anchorCorrectionOffset(-27, -27)).toBe(0);
    expect(anchorCorrectionOffset(-3, 49)).toBe(52);
    expect(anchorCorrectionOffset(176.5, -17.5)).toBe(-194);
    expect(attachedCellsFromResult(JSON.stringify({ data: { attachedCells: [
      { itemKey: '1', top: -27 },
    ] } }))).toEqual([{ itemKey: '1', top: -27 }]);
    expect(shouldRestoreAnchor(4, 4)).toBe(true);
    expect(shouldRestoreAnchor(4, 5)).toBe(false);
  });

  it('falls back to the earliest attached cell when every cell is clipped', () => {
    expect(findTimelineAnchor([
      { itemKey: '2', top: -4 },
      { itemKey: '1', top: -40 },
    ], [item('1'), item('2')])).toEqual({ itemKey: '1', index: 0, top: -40 });
  });

  it('falls forward to another previously visible cell if projection removes the first anchor', () => {
    const candidates = [
      { itemKey: 'reasoning-that-will-merge', top: -27 },
      { itemKey: 'stable-assistant', top: 64 },
    ];
    expect(resolveTimelineAnchor(candidates, new Set(['stable-assistant', 'new-earlier-item'])))
      .toEqual({ itemKey: 'stable-assistant', top: 64 });
  });
});

describe('native list child positions', () => {
  it('accounts for the loader and optional top spacer before message items', () => {
    expect(timelineListPosition(0)).toBe(1);
    expect(timelineListPosition(4)).toBe(5);
    expect(timelineListPosition(4, true)).toBe(6);
  });
});

describe('bounded history buffering', () => {
  it('refills to a fixed buffer without mounting or fetching 50 entries', () => {
    expect(planEarlierReveal({
      availableAbove: 0,
      visibleCount: 3,
      totalCount: 100,
      hasEarlier: true,
    })).toEqual({ localCount: 9, revealCount: 9, remoteCount: 0 });
    expect(planEarlierReveal({
      availableAbove: 6,
      visibleCount: 100,
      totalCount: 100,
      hasEarlier: true,
    })).toEqual({ localCount: 0, revealCount: 3, remoteCount: 24 });
    expect(planEarlierReveal({
      availableAbove: 9,
      visibleCount: 100,
      totalCount: 100,
      hasEarlier: true,
    })).toEqual({ localCount: 0, revealCount: 0, remoteCount: 0 });
  });

  it('keeps six projected entries hidden after a sufficiently large remote page', () => {
    expect(revealCountForRemotePage(11, 9)).toBe(5);
    expect(revealCountForRemotePage(4, 9)).toBe(3);
    expect(revealCountForRemotePage(2, 9)).toBe(2);
  });

  it('chains a remote page when the local window cannot satisfy the requested top buffer', () => {
    expect(shouldChainRemoteReveal({ localCount: 1, revealCount: 5, remoteCount: 0 }, true)).toBe(true);
    expect(shouldChainRemoteReveal({ localCount: 5, revealCount: 5, remoteCount: 0 }, true)).toBe(false);
    expect(shouldChainRemoteReveal({ localCount: 1, revealCount: 5, remoteCount: 0 }, false)).toBe(false);
  });
});

describe('list layout request identity', () => {
  it('changes when prepend projection replaces the first item without changing item count', () => {
    expect(timelineLayoutId([item('old'), item('tail')]))
      .not.toBe(timelineLayoutId([item('new'), item('tail')]));
  });
});

describe('height estimates and cache', () => {
  it('accounts for Markdown lines and code blocks instead of only character count', () => {
    const oneLine = estimateTimelineItemHeight(item('1', 'short'));
    const markdown = estimateTimelineItemHeight(item('2', '# Header\n\n- first\n- second\n```ts\nconst x = 1\n```'));
    expect(markdown).toBeGreaterThan(oneLine * 2);
  });

  it('updates measurements in place and can prune stale entries', () => {
    const cache = new TimelineHeightCache();
    expect(cache.set('a', 100)).toBe(true);
    expect(cache.set('a', 100)).toBe(false);
    cache.set('b', 120);
    cache.prune(new Set(['b']));
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('reveal trace lifecycle', () => {
  it('closes on anchor settlement so a later scroll cannot extend the metric', () => {
    expect(isTerminalRevealPhase('anchor-scroll-success')).toBe(false);
    expect(isTerminalRevealPhase('complete')).toBe(true);
    expect(isTerminalRevealPhase('element-on-screen')).toBe(false);
  });
});

describe('history loader lifecycle', () => {
  it('appears only for an outstanding remote request and retracts promptly', () => {
    expect(historyLoaderTransition({ loading: true, visible: false, shownAt: 0, now: 0 }))
      .toEqual({ visible: true, hideAfterMs: null });
    expect(historyLoaderTransition({ loading: false, visible: true, shownAt: 100, now: 180 }))
      .toEqual({ visible: true, hideAfterMs: 80 });
    expect(historyLoaderTransition({ loading: false, visible: true, shownAt: 100, now: 300 }))
      .toEqual({ visible: true, hideAfterMs: 0 });
  });
});
