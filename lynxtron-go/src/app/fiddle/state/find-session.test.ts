import { describe, expect, it } from 'vitest';
import { openFindSession, searchFindSession } from './find-session';

describe('Fiddle find session', () => {
  it('preserves a repeated Find but starts fresh for another editor', () => {
    const original = searchFindSession(openFindSession(null, 'main.js'), 'needle', 'needle').state;
    expect(openFindSession(original, 'main.js')).toBe(original);
    expect(openFindSession(original, 'renderer.js')).toEqual({
      editorId: 'renderer.js', query: '', matches: [], index: -1,
    });
  });

  it.each([
    ['// A中文😀B needle needle', 'needle'],
    ['café\r\n中文😀B needle', 'needle'],
    ['A中文😀B', '中文😀'],
    ['first\n中文😀\nlast', '中文😀\nlast'],
  ])('selects UTF-8 bytes in %j', (text, query) => {
    const result = searchFindSession(openFindSession(null, 'main.js'), text, query);
    const { anchor, caret } = result.selection!;
    expect(Buffer.from(text).subarray(anchor, caret).toString()).toBe(query);
  });

  it('wraps in both directions without changing the owner', () => {
    const text = 'n n n';
    const first = searchFindSession(openFindSession(null, 'main.js'), text, 'n').state;
    const last = searchFindSession(first, text, 'n', 'previous').state;
    expect(last.index).toBe(2);
    const wrapped = searchFindSession(last, text, 'n', 'next').state;
    expect(wrapped.index).toBe(0);
    expect(wrapped.editorId).toBe('main.js');
  });

  it('uses current text on navigation and avoids stale selections after edits', () => {
    const state = searchFindSession(openFindSession(null, 'main.js'), 'n n', 'n').state;
    const updated = searchFindSession(state, '中文 n', 'n', 'next');
    expect(updated.selection).toEqual({ anchor: 7, caret: 8 });
    const removed = searchFindSession(updated.state, 'gone', 'needle', 'next');
    expect(removed.selection).toBeNull();
    expect(removed.state.index).toBe(-1);
    expect(searchFindSession(state, 'n n', '').selection).toBeNull();
  });
});
