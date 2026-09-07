import { useEffect, useState } from '@lynx-js/react';
import { openFindSession, searchFindSession, type FindSession } from './find-session';
import { scintillaApi } from '../../store';
import { scintillaIdFor, type UseFiddleResult } from './useFiddle';

export function useFiddleFind(fiddle: UseFiddleResult) {
  const [state, setState] = useState<FindSession | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [focusAfterClose, setFocusAfterClose] = useState<string | null>(null);

  const open = () => {
    const editorId = fiddle.getFindEditorId();
    if (!editorId) return;
    setState(prev => openFindSession(prev, editorId));
    setFocusKey(key => key + 1);
  };
  const close = () => {
    setFocusAfterClose(state?.editorId ?? null);
    setState(null);
  };
  const search = (query: string, direction?: 'next' | 'previous') => {
    if (!state) return;
    const text = fiddle.readEditorText(state.editorId);
    if (text === null) { setState(null); return; }
    const result = searchFindSession(state, text, query, direction);
    setState(result.state);
    if (result.selection) {
      const { anchor, caret } = result.selection;
      const api = scintillaApi();
      api.setSelection(scintillaIdFor(state.editorId), anchor, caret);
      api.scrollCaret(scintillaIdFor(state.editorId));
    }
  };

  // Replacing the project or removing/hiding the owner invalidates its query.
  useEffect(() => { setState(null); setFocusAfterClose(null); }, [fiddle.snap.source]);
  useEffect(() => {
    if (state && !fiddle.snap.files.get(state.editorId)?.visible) setState(null);
  }, [fiddle.snap.files, state?.editorId]);
  useEffect(() => {
    if (state || !focusAfterClose) return;
    // Removing the native input resigns first responder asynchronously.
    // Restore editor focus after that removal, not before it.
    const timer = setTimeout(() => {
      if (fiddle.snap.files.get(focusAfterClose)?.visible) fiddle.selectEditor(focusAfterClose);
      setFocusAfterClose(null);
    }, 120);
    return () => clearTimeout(timer);
  }, [state, focusAfterClose, fiddle.snap.files, fiddle.selectEditor]);

  return { state, focusKey, open, close,
    updateQuery: (query: string) => search(query),
    navigate: (direction: 'next' | 'previous') => search(state?.query ?? '', direction),
  };
}
