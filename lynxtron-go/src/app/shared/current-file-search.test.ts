import { describe, expect, it } from 'vitest';
import {
  findCurrentFileMatches,
  getWrappedMatchIndex,
  stringRangeToUtf8ByteRange,
} from './current-file-search';

describe('findCurrentFileMatches', () => {
  it('finds plain case-insensitive substring matches', () => {
    expect(findCurrentFileMatches('Alpha beta ALPHA', 'alpha')).toEqual([
      { start: 0, end: 5, line: 0, column: 0 },
      { start: 11, end: 16, line: 0, column: 11 },
    ]);
  });

  it('tracks line and column positions', () => {
    expect(findCurrentFileMatches('one\ntwo one\nthree', 'one')).toEqual([
      { start: 0, end: 3, line: 0, column: 0 },
      { start: 8, end: 11, line: 1, column: 4 },
    ]);
  });

  it('returns no matches for an empty query', () => {
    expect(findCurrentFileMatches('anything', '')).toEqual([]);
  });
});

describe('getWrappedMatchIndex', () => {
  it('wraps next and previous navigation', () => {
    expect(getWrappedMatchIndex(0, 3, 'next')).toBe(1);
    expect(getWrappedMatchIndex(2, 3, 'next')).toBe(0);
    expect(getWrappedMatchIndex(0, 3, 'previous')).toBe(2);
  });

  it('starts at the edge matching the direction', () => {
    expect(getWrappedMatchIndex(-1, 3, 'next')).toBe(0);
    expect(getWrappedMatchIndex(-1, 3, 'previous')).toBe(2);
    expect(getWrappedMatchIndex(0, 0, 'next')).toBe(-1);
  });
});

describe('stringRangeToUtf8ByteRange', () => {
  it('converts UTF-16 search offsets to Scintilla UTF-8 byte offsets', () => {
    const text = 'A中文😀B';
    expect(stringRangeToUtf8ByteRange(text, 1, 5)).toEqual({
      anchor: 1,
      caret: 11,
    });
  });

  it('clamps ranges to the document', () => {
    expect(stringRangeToUtf8ByteRange('abc', -10, 99)).toEqual({
      anchor: 0,
      caret: 3,
    });
  });
});
