import type { TimelineEntry } from '../shared/agent';

/** Linear-time merge used when a completed live turn becomes persisted history. */
export function mergeTimelineEntriesById(
  history: TimelineEntry[],
  additions: TimelineEntry[],
): TimelineEntry[] {
  if (additions.length === 0) return history;
  const next = [...history];
  const indices = new Map(next.map((item, index) => [item.id, index]));
  for (const addition of additions) {
    const index = indices.get(addition.id);
    if (index === undefined) {
      indices.set(addition.id, next.length);
      next.push(addition);
    } else {
      next[index] = addition;
    }
  }
  return next;
}

/** Keep the large history projection stable when there is no live overlay. */
export function overlayTimelineEntries(
  history: TimelineEntry[],
  live: TimelineEntry[],
): TimelineEntry[] {
  return live.length === 0 ? history : mergeTimelineEntriesById(history, live);
}

export function prependUniqueTimelineEntries(
  current: TimelineEntry[],
  page: TimelineEntry[],
): { items: TimelineEntry[]; added: TimelineEntry[] } {
  if (page.length === 0) return { items: current, added: [] };
  const existing = new Set(current.map((item) => item.id));
  const added = page.filter((item) => !existing.has(item.id));
  return {
    items: added.length > 0 ? [...added, ...current] : current,
    added,
  };
}

export function latestTimelineEntriesOfKinds(
  history: TimelineEntry[],
  live: TimelineEntry[],
  kinds: Set<TimelineEntry['kind']>,
  limit: number,
): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  const seen = new Set<string>();
  for (const source of [live, history]) {
    for (let index = source.length - 1; index >= 0 && result.length < limit; index -= 1) {
      const candidate = source[index];
      if (!kinds.has(candidate.kind) || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      result.push(candidate);
    }
    if (result.length >= limit) break;
  }
  return result;
}
