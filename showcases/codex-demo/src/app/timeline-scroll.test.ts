import { describe, expect, it } from 'vitest';
import { isTimelineAtTail, shouldRevealEarlierFromScroll } from './timeline-scroll';

describe('shouldRevealEarlierFromScroll', () => {
  it('accepts the real macOS top event even when deltaY is positive', () => {
    expect(shouldRevealEarlierFromScroll({ scrollTop: 3, eventSource: 2 })).toBe(true);
  });

  it('ignores layout and programmatic updates', () => {
    expect(shouldRevealEarlierFromScroll({ scrollTop: 0, eventSource: 0 })).toBe(false);
    expect(shouldRevealEarlierFromScroll({ scrollTop: 0, eventSource: 1 })).toBe(false);
  });

  it('waits until the user reaches the top threshold', () => {
    expect(shouldRevealEarlierFromScroll({ scrollTop: 9, eventSource: 2 })).toBe(false);
  });
});

describe('isTimelineAtTail', () => {
  it('treats the final 48 pixels as the live tail', () => {
    expect(isTimelineAtTail({ scrollTop: 952, scrollHeight: 1400, listHeight: 400 })).toBe(true);
    expect(isTimelineAtTail({ scrollTop: 900, scrollHeight: 1400, listHeight: 400 })).toBe(false);
  });
});
