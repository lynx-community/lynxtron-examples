import { describe, expect, it } from 'vitest';
import {
  anchorCorrection,
  computeEdgeSnapshot,
  EdgeEpisodeTracker,
  firstStableAnchor,
} from './model';

describe('BidirectionalList edge geometry', () => {
  it('treats both edges as reached when supplied content leaves free viewport space', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 2,
      viewport: { start: 0, end: 600 },
      cells: [
        { key: 'a', index: 0, top: 0, bottom: 100 },
        { key: 'b', index: 1, top: 100, bottom: 180 },
      ],
    });
    expect(snapshot.start.reached).toBe(true);
    expect(snapshot.end.reached).toBe(true);
  });

  it('does not call interior visible cells a reached edge', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 30,
      viewport: { start: 0, end: 400 },
      cells: [
        { key: '12', index: 12, top: 0, bottom: 100 },
        { key: '15', index: 15, top: 100, bottom: 200 },
      ],
    });
    expect(snapshot.start.reached).toBe(false);
    expect(snapshot.end.reached).toBe(false);
  });

  it('reports the supplied start and end independently', () => {
    const start = computeEdgeSnapshot({
      totalItems: 20,
      viewport: { start: 0, end: 300 },
      cells: [
        { key: '0', index: 0, top: 0, bottom: 100 },
        { key: '1', index: 1, top: 100, bottom: 200 },
      ],
    });
    expect(start.start.reached).toBe(true);
    expect(start.end.reached).toBe(false);

    const end = computeEdgeSnapshot({
      totalItems: 20,
      viewport: { start: 0, end: 300 },
      cells: [
        { key: '18', index: 18, top: 0, bottom: 100 },
        { key: '19', index: 19, top: 100, bottom: 200 },
      ],
    });
    expect(end.start.reached).toBe(false);
    expect(end.end.reached).toBe(true);
  });

  it('uses native scroll metrics as the authoritative reached boundary', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 8,
      viewport: { start: 0, end: 320 },
      scrollMetrics: { scrollTop: 504, scrollHeight: 824, listHeight: 320 },
      cells: [
        { key: '5', index: 5, top: 42, bottom: 114 },
        { key: '6', index: 6, top: 114, bottom: 230 },
        // Deliberately inconsistent cell geometry: the native scroll range still says end.
        { key: '7', index: 7, top: 230, bottom: 330 },
      ],
    });
    expect(snapshot.start.reached).toBe(false);
    expect(snapshot.end.reached).toBe(true);
  });

  it('treats an empty sequence as reached at both edges', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 0,
      viewport: { start: 0, end: 400 },
      cells: [],
    });
    expect(snapshot.start.reached).toBe(true);
    expect(snapshot.end.reached).toBe(true);
  });

  it('does not mistake temporarily unavailable measurements for an empty list', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 8,
      viewport: { start: 0, end: 400 },
      cells: [],
    });
    expect(snapshot.geometry.source).toBe('unavailable');
    expect(snapshot.start.reached).toBe(false);
    expect(snapshot.end.reached).toBe(false);
  });

  it('uses supplied item distance for near-edge prefetching', () => {
    const snapshot = computeEdgeSnapshot({
      totalItems: 20,
      viewport: { start: 0, end: 300 },
      threshold: 2,
      cells: [
        { key: '3', index: 3, top: -20, bottom: 80 },
        { key: '4', index: 4, top: 80, bottom: 180 },
        { key: '5', index: 5, top: 180, bottom: 280 },
      ],
    });
    expect(snapshot.start.near).toBe(false);
    expect(snapshot.end.near).toBe(false);
  });
});

describe('BidirectionalList anchor model', () => {
  it('prefers the first fully visible item and preserves sub-pixel offsets', () => {
    const anchor = firstStableAnchor([
      { key: 'clipped', index: 4, top: -32.25, bottom: 20 },
      { key: 'stable', index: 5, top: 20, bottom: 140 },
    ], 0);
    expect(anchor?.key).toBe('stable');
    expect(anchorCorrection(44.75, 20)).toBe(-24.75);
  });
});

describe('BidirectionalList edge episodes', () => {
  const underfilled = computeEdgeSnapshot({
    totalItems: 1,
    viewport: { start: 0, end: 500 },
    cells: [{ key: 'a', index: 0, top: 0, bottom: 100 }],
  });

  it('emits each reached edge once for the same revision', () => {
    const tracker = new EdgeEpisodeTracker();
    const initial = tracker.observe(underfilled, 'initial-layout', 1);
    expect(initial.map((event) => event.edge)).toEqual(['start', 'end']);
    expect(initial.every((event) => event.origin === 'initial')).toBe(true);
    expect(tracker.observe(underfilled, 'content-resize', 1)).toEqual([]);
  });

  it('starts a new episode after supplied data changes while content remains underfilled', () => {
    const tracker = new EdgeEpisodeTracker();
    tracker.observe(underfilled, 'initial-layout', 1);
    const next = tracker.observe(underfilled, 'insert', 2);
    expect(next.map((event) => event.edge)).toEqual(['start', 'end']);
    expect(next.every((event) => event.origin === 'content')).toBe(true);
    expect(new Set(next.map((event) => event.episodeId)).size).toBe(2);
  });

  it('marks gesture-driven episodes as user origin', () => {
    const tracker = new EdgeEpisodeTracker();
    const events = tracker.observe(underfilled, 'user-scroll', 1);
    expect(events.every((event) => event.origin === 'user')).toBe(true);
  });
});
