import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../shared/agent';
import {
  latestTimelineEntriesOfKinds,
  mergeTimelineEntriesById,
  overlayTimelineEntries,
  prependUniqueTimelineEntries,
} from './timeline-data';

const entry = (id: string, text = id): TimelineEntry => ({ id, text, sequence: 1, kind: 'assistant' });

describe('timeline data projection', () => {
  it('preserves the history array when no live work exists', () => {
    const history = [entry('a')];
    expect(overlayTimelineEntries(history, [])).toBe(history);
  });

  it('merges replacements and additions in linear insertion order', () => {
    expect(mergeTimelineEntriesById(
      [entry('a'), entry('b')],
      [entry('b', 'updated'), entry('c')],
    )).toEqual([entry('a'), entry('b', 'updated'), entry('c')]);
  });

  it('reads only the newest matching activity entries across live and history', () => {
    const tool = (id: string): TimelineEntry => ({ id, sequence: 1, kind: 'tool' });
    expect(latestTimelineEntriesOfKinds(
      [tool('old'), entry('ignored'), tool('middle')],
      [tool('new')],
      new Set(['tool']),
      2,
    ).map((value) => value.id)).toEqual(['new', 'middle']);
  });

  it('reports actual additions instead of the remote page size', () => {
    const current = [entry('b'), entry('c')];
    expect(prependUniqueTimelineEntries(current, [entry('a'), entry('b')])).toEqual({
      items: [entry('a'), entry('b'), entry('c')],
      added: [entry('a')],
    });
    expect(prependUniqueTimelineEntries(current, [entry('b'), entry('c')])).toEqual({
      items: current,
      added: [],
    });
  });
});
