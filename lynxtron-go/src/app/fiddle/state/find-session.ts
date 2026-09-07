import { findCurrentFileMatches, getWrappedMatchIndex, type CurrentFileMatch } from '../../shared/current-file-search';
import { utf8ByteLength } from '../../diagnostics';

export interface FindSession {
  editorId: string;
  query: string;
  matches: CurrentFileMatch[];
  index: number;
}

export function openFindSession(previous: FindSession | null, editorId: string): FindSession {
  return previous?.editorId === editorId
    ? previous : { editorId, query: '', matches: [], index: -1 };
}

export function searchFindSession(
  state: FindSession, text: string, query: string, direction?: 'next' | 'previous',
) {
  const matches = findCurrentFileMatches(text, query);
  const index = direction ? getWrappedMatchIndex(state.index, matches.length, direction)
    : matches.length ? 0 : -1;
  const match = matches[index];
  const selection = match ? {
    anchor: utf8ByteLength(text.slice(0, match.start)),
    caret: utf8ByteLength(text.slice(0, match.end)),
  } : null;
  return { state: { ...state, query, matches, index }, selection };
}
