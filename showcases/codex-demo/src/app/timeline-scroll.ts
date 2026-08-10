export interface TimelineScrollDetail {
  scrollTop?: number;
  scrollHeight?: number;
  listHeight?: number;
  eventSource?: number;
}

export type TimelineScrollDirection = 'up' | 'down' | 'stationary';

export function timelineScrollDirection(previousTop: number | null, currentTop: unknown): TimelineScrollDirection {
  if (previousTop === null || typeof currentTop !== 'number') return 'stationary';
  if (currentTop < previousTop - 0.5) return 'up';
  if (currentTop > previousTop + 0.5) return 'down';
  return 'stationary';
}

export function shouldRevealEarlierFromScroll(detail: TimelineScrollDetail): boolean {
  return typeof detail.scrollTop === 'number'
    && detail.scrollTop <= 8
    && detail.eventSource === 2;
}

export function isTimelineAtTail(detail: TimelineScrollDetail, threshold = 48): boolean {
  return typeof detail.scrollTop === 'number'
    && typeof detail.scrollHeight === 'number'
    && typeof detail.listHeight === 'number'
    && detail.scrollHeight - detail.listHeight - detail.scrollTop <= threshold;
}
