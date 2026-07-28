import { utf8ByteLength } from '../diagnostics';

export interface CurrentFileMatch {
  start: number;
  end: number;
  line: number;
  column: number;
}

export function findCurrentFileMatches(text: string, query: string): CurrentFileMatch[] {
  if (!query) return [];

  const matches: CurrentFileMatch[] = [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let fromIndex = 0;

  while (fromIndex <= haystack.length) {
    const start = haystack.indexOf(needle, fromIndex);
    if (start < 0) break;
    const position = offsetToLineColumn(text, start);
    matches.push({
      start,
      end: start + query.length,
      line: position.line,
      column: position.column,
    });
    fromIndex = start + Math.max(query.length, 1);
  }

  return matches;
}

export function stringRangeToUtf8ByteRange(
  text: string,
  start: number,
  end: number,
): { anchor: number; caret: number } {
  const clampedStart = Math.min(Math.max(start, 0), text.length);
  const clampedEnd = Math.min(Math.max(end, clampedStart), text.length);
  const anchor = utf8ByteLength(text.slice(0, clampedStart));
  return {
    anchor,
    caret: anchor + utf8ByteLength(text.slice(clampedStart, clampedEnd)),
  };
}

export function getWrappedMatchIndex(
  currentIndex: number,
  total: number,
  direction: 'next' | 'previous',
): number {
  if (total <= 0) return -1;
  if (currentIndex < 0 || currentIndex >= total) return direction === 'previous' ? total - 1 : 0;
  return direction === 'previous'
    ? (currentIndex - 1 + total) % total
    : (currentIndex + 1) % total;
}

function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const clampedOffset = Math.min(Math.max(offset, 0), text.length);
  let line = 0;
  let lineStart = 0;

  for (let i = 0; i < clampedOffset; i++) {
    if (text[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }

  return { line, column: clampedOffset - lineStart };
}
