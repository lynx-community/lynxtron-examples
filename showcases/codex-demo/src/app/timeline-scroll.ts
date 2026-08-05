export interface TimelineScrollDetail {
  scrollTop?: number;
  eventSource?: number;
}

export function shouldRevealEarlierFromScroll(detail: TimelineScrollDetail): boolean {
  return typeof detail.scrollTop === 'number'
    && detail.scrollTop <= 8
    && detail.eventSource === 2;
}
