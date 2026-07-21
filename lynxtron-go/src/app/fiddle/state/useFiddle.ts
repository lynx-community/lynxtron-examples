import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { scintillaApi, getExposed, foundationApi, appendFiddleOutput as appendOutput } from '../../store';
import { computeStyles, detectLanguage } from '../../syntax';
import { bytesToBase64 } from '../../shared/native-bridge-encoding';
import {
  emptyFiddle,
  helloLynxtronFiddle,
  blankFiddle,
  isFiddleEdited,
  serializeFiddle,
  visibleEditorIds,
  defaultVisibleIds,
  toPersisted,
  fromPersisted,
  type FiddleSnapshot,
  type EditorId,
} from './FiddleState';

const SESSION_KEY = 'fiddle.lastSession';
// All instances of this app share one config store (same app name), so a
// self-hosted child Fiddle would silently overwrite the parent's session.
// Single-writer lease: first instance claims it and heartbeats; later
// instances run with persistence read-only until the lease goes stale.
const WRITER_KEY = 'fiddle.session.writer';
const WRITER_STALE_MS = 5000;

function restoreLastSession(): FiddleSnapshot | null {
  try {
    const raw = foundationApi()?.config?.get?.(SESSION_KEY);
    if (!raw) return null;
    return fromPersisted(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch (_) {
    return null;
  }
}

// Each fiddle file gets its own live Scintilla instance, keyed by a stable
// per-file editor id. Distinct from the old IDE's 'main-editor' so App.tsx's
// legacy single-editor plumbing can never collide with mosaic panes.
export function scintillaIdFor(fileId: EditorId): string {
  return 'fiddle:' + fileId;
}

export interface UseFiddleResult {
  snap: FiddleSnapshot;
  isEdited: boolean;
  selectEditor: (id: EditorId) => void;
  showEditor: (id: EditorId) => void;
  hideEditor: (id: EditorId) => void;
  toggleEditor: (id: EditorId) => void;
  resetLayout: () => void;
  markSaved: () => void;
  resetToTemplate: () => void;
  loadTemplate: (kind: 'blank' | 'hello-lynxtron') => void;
  loadSnapshot: (snap: FiddleSnapshot) => void;
  flushAll: () => void;
  /** Push a file's state text + highlight into its native editor (pane mount). */
  pushContent: (id: EditorId) => void;
  addFile: (id: EditorId) => void;
  removeFile: (id: EditorId) => void;
  renameFile: (oldId: EditorId, newId: EditorId) => void;
  setFileContent: (id: EditorId, content: string) => void;
  values: () => Record<EditorId, string>;
  /** Immediate session write (quit path) — flushAll() first for live text. */
  persistNow: () => void;
}

function pushHighlight(fileId: EditorId, text: string, language: any) {
  try {
    const styles = computeStyles(text, language);
    const api = scintillaApi();
    if (!api) return;
    // win32 build takes base64; darwin takes ArrayBuffer (mirrors App.tsx applyHighlight)
    if (getExposed()?.platform === 'win32') {
      api.setStyles(scintillaIdFor(fileId), 0, bytesToBase64(styles));
    } else {
      api.setStyles(scintillaIdFor(fileId), 0, styles.buffer);
    }
  } catch (_) { /* not attached yet */ }
}

/**
 * Multi-pane fiddle state. Owns the file set, per-file visibility (mosaic
 * panes), and the content/highlight poll loop over every visible editor.
 */
export function useFiddle(): UseFiddleResult {
  // Restore the previous session on boot (upstream keeps your fiddle as the
  // app's persistent workspace state); fall back to the default template.
  const [snap, setSnap] = useState<FiddleSnapshot>(() => restoreLastSession() ?? emptyFiddle());
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const highlightTimers = useRef<Map<EditorId, any>>(new Map());
  const lastPersisted = useRef<string | null>(null);
  // Live native text per visible editor. The 100ms poll updates THIS (a ref)
  // instead of React state — a setSnap per keystroke re-rendered the whole
  // Fiddle tree. React state only changes when a file's dirty flag flips;
  // currentText syncs on explicit flushes (save/run/hide/dialog) and the
  // persist tick folds live text in without touching state.
  const liveText = useRef<Map<EditorId, string>>(new Map());

  /** Current snapshot with live native text folded in — pure, no setState. */
  const snapWithLive = useCallback((): FiddleSnapshot => {
    const s = snapRef.current;
    let files: Map<EditorId, any> | null = null;
    for (const [id, t] of liveText.current.entries()) {
      const f = s.files.get(id);
      if (!f || !f.visible || f.currentText === t) continue;
      if (!files) files = new Map(s.files);
      files.set(id, { ...f, currentText: t, isDirty: t !== f.savedContent });
    }
    return files ? { ...s, files } : s;
  }, []);

  // Periodic session persistence with change detection. A mount-time-only
  // effect is unreliable here: the preload `exposed` bridge may not be ready
  // yet, and with no further snapshot changes the write would never retry.
  const writerToken = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const readOnlyAnnounced = useRef(false);

  // Single-writer lease: another live instance (fresh heartbeat, different
  // token) owns session persistence — this one must not write.
  const otherWriterHoldsLease = useCallback((cfg: any, now: number): boolean => {
    let writer: { token?: string; ts?: number } | null = null;
    try { writer = JSON.parse(cfg.get?.(WRITER_KEY) ?? 'null'); } catch (_) {}
    return !!(writer?.token && writer.token !== writerToken.current
      && typeof writer.ts === 'number' && now - writer.ts < WRITER_STALE_MS);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const cfg = foundationApi()?.config;
        if (!cfg?.set) return; // bridge not ready yet — retry next tick

        const now = Date.now();
        if (otherWriterHoldsLease(cfg, now)) {
          if (!readOnlyAnnounced.current) {
            readOnlyAnnounced.current = true;
            appendOutput('info', '[Fiddle] Another instance owns session persistence — this one is read-only.');
          }
          return;
        }
        cfg.set(WRITER_KEY, JSON.stringify({ token: writerToken.current, ts: now }));
        readOnlyAnnounced.current = false;

        const serialized = JSON.stringify(toPersisted(snapWithLive()));
        if (serialized === lastPersisted.current) return;
        cfg.set(SESSION_KEY, serialized);
        lastPersisted.current = serialized;
      } catch (_) {}
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Synchronous best-effort session write — quit paths can't wait for the
      1.5s tick. Respects the single-writer lease (read-only children skip). */
  const persistNow = useCallback(() => {
    try {
      const cfg = foundationApi()?.config;
      if (!cfg?.set) return;
      if (otherWriterHoldsLease(cfg, Date.now())) return;
      const serialized = JSON.stringify(toPersisted(snapWithLive()));
      cfg.set(SESSION_KEY, serialized);
      lastPersisted.current = serialized;
    } catch (_) {}
  }, [snapWithLive, otherWriterHoldsLease]);

  /** Read live native text for one visible file into state. Returns latest text. */
  const flushEditor = useCallback((id: EditorId): string | null => {
    const f = snapRef.current.files.get(id);
    if (!f || !f.visible) return null;
    try {
      const text: string | undefined = scintillaApi()?.getText(scintillaIdFor(id));
      if (typeof text !== 'string') return null;
      liveText.current.set(id, text);
      if (text !== f.currentText) {
        setSnap(prev => {
          const cur = prev.files.get(id);
          if (!cur || cur.currentText === text) return prev;
          const next = new Map(prev.files);
          next.set(id, { ...cur, currentText: text, isDirty: text !== cur.savedContent });
          return { ...prev, files: next };
        });
      }
      return text;
    } catch (_) {
      return null;
    }
  }, []);

  /** Flush every visible pane's native buffer into state (before save/run/publish/unmount). */
  const flushAll = useCallback(() => {
    for (const id of visibleEditorIds(snapRef.current)) flushEditor(id);
  }, [flushEditor]);

  const pushToScintilla = useCallback((id: EditorId, snapshot: FiddleSnapshot) => {
    const f = snapshot.files.get(id);
    if (!f) return;
    // Live text (if any) is fresher than React state — pushing stale state
    // over a re-attached editor would drop the user's latest keystrokes.
    const text = liveText.current.get(id) ?? f.currentText;
    try {
      scintillaApi()?.setText(scintillaIdFor(id), text);
      liveText.current.set(id, text);
      pushHighlight(id, text, f.language);
    } catch (_) { /* not attached */ }
  }, []);

  /** Push all visible files' content into their (possibly pending) native editors. */
  const pushAll = useCallback((snapshot: FiddleSnapshot) => {
    for (const [id, f] of snapshot.files.entries()) {
      if (f.visible) pushToScintilla(id, snapshot);
    }
  }, [pushToScintilla]);

  // ── Content + highlight poll loop over visible panes (fiddle-scoped; the
  // legacy App.tsx loop only ever serviced the old IDE's 'main-editor'). ──
  useEffect(() => {
    const timer = setInterval(() => {
      const api = scintillaApi();
      if (!api) return;
      for (const id of visibleEditorIds(snapRef.current)) {
        try {
          if (!api.hasContentChanged(scintillaIdFor(id))) continue;
        } catch (_) { continue; }
        let text: string | undefined;
        try { text = api.getText(scintillaIdFor(id)); } catch (_) { continue; }
        if (typeof text !== 'string') continue;
        const f = snapRef.current.files.get(id);
        if (!f) continue;
        // Ref-only update — React state is untouched unless dirty flips.
        liveText.current.set(id, text);
        const dirty = text !== f.savedContent;
        if (dirty !== f.isDirty) {
          setSnap(prev => {
            const cur = prev.files.get(id);
            if (!cur || cur.isDirty === dirty) return prev;
            const next = new Map(prev.files);
            next.set(id, { ...cur, isDirty: dirty });
            return { ...prev, files: next };
          });
        }
        // debounce re-highlight per editor (150ms after last change tick)
        const timers = highlightTimers.current;
        const existing = timers.get(id);
        if (existing) clearTimeout(existing);
        const captured = text;
        timers.set(id, setTimeout(() => {
          timers.delete(id);
          const latest = snapRef.current.files.get(id);
          if (latest?.visible) pushHighlight(id, liveText.current.get(id) ?? captured, latest.language);
        }, 150));
      }
    }, 100);
    return () => {
      clearInterval(timer);
      for (const t of highlightTimers.current.values()) clearTimeout(t);
      highlightTimers.current.clear();
    };
  }, [flushEditor]);

  const setVisible = useCallback((id: EditorId, visible: boolean) => {
    setSnap(prev => {
      const cur = prev.files.get(id);
      if (!cur || cur.visible === visible) return prev;
      const next = new Map(prev.files);
      next.set(id, { ...cur, visible });
      return { ...prev, files: next };
    });
  }, []);

  const showEditor = useCallback((id: EditorId) => {
    setVisible(id, true);
    // Content push happens via pending buffers: safe even before the native
    // view registers (ScintillaRegistry applies pending content at mount).
    const f = snapRef.current.files.get(id);
    if (f) {
      try {
        scintillaApi()?.setText(scintillaIdFor(id), f.currentText);
        pushHighlight(id, f.currentText, f.language);
      } catch (_) {}
    }
  }, [setVisible]);

  const hideEditor = useCallback((id: EditorId) => {
    // Native buffer dies with the pane — capture live text first.
    flushEditor(id);
    setVisible(id, false);
  }, [flushEditor, setVisible]);

  const toggleEditor = useCallback((id: EditorId) => {
    const f = snapRef.current.files.get(id);
    if (!f) return;
    if (f.visible) hideEditor(id);
    else showEditor(id);
  }, [hideEditor, showEditor]);

  /** Upstream resetLayout(): restore the load-time default layout — the few
      important files — not every file side by side. */
  const resetLayout = useCallback(() => {
    flushAll();
    setSnap(prev => {
      const show = defaultVisibleIds(prev.files);
      const next = new Map(prev.files);
      for (const [id, f] of prev.files.entries()) {
        const shouldShow = show.has(id);
        if (f.visible !== shouldShow) next.set(id, { ...f, visible: shouldShow });
      }
      return { ...prev, files: next };
    });
  }, [flushAll]);

  const selectEditor = useCallback((id: EditorId) => {
    // Sidebar click: focus the file; if hidden, show it first (upstream setFocusedFile).
    const f = snapRef.current.files.get(id);
    const wasHidden = !!f && !f.visible;
    if (wasHidden) showEditor(id);
    setSnap(prev => (prev.activeEditorId === id ? prev : { ...prev, activeEditorId: id }));
    // Keyboard focus follows the selection (upstream editor.focus()). A pane
    // that was just shown attaches on its first layout pass — retry once.
    const focusNative = () => { try { scintillaApi()?.focus?.(scintillaIdFor(id)); } catch (_) {} };
    focusNative();
    if (wasHidden) setTimeout(focusNative, 250);
  }, [showEditor]);

  const markSaved = useCallback(() => {
    flushAll();
    setSnap(prev => {
      const next = new Map(prev.files);
      for (const [id, f] of prev.files.entries()) {
        next.set(id, { ...f, savedContent: f.currentText, isDirty: false });
      }
      return { ...prev, files: next };
    });
  }, [flushAll]);

  const loadFresh = useCallback((fresh: FiddleSnapshot) => {
    liveText.current.clear();
    setSnap(fresh);
    snapRef.current = fresh;
    pushAll(fresh);
  }, [pushAll]);

  const resetToTemplate = useCallback(() => loadFresh(emptyFiddle()), [loadFresh]);

  const loadTemplate = useCallback((kind: 'blank' | 'hello-lynxtron') => {
    loadFresh(kind === 'blank' ? blankFiddle() : helloLynxtronFiddle());
  }, [loadFresh]);

  const loadSnapshot = useCallback((fresh: FiddleSnapshot) => loadFresh(fresh), [loadFresh]);

  /** Serialize with live native text folded in synchronously (for run/save/publish).
      One native read per pane: flushEditor both returns the live text and
      syncs it into state (the old version read every editor twice). */
  const values = useCallback((): Record<EditorId, string> => {
    const out = serializeFiddle(snapRef.current);
    for (const id of visibleEditorIds(snapRef.current)) {
      const text = flushEditor(id);
      if (text != null) out[id] = text;
    }
    return out;
  }, [flushEditor]);

  const pushContent = useCallback((id: EditorId) => {
    pushToScintilla(id, snapRef.current);
  }, [pushToScintilla]);

  /** Programmatically replace a file's content (e.g. npm add → package.json). */
  const setFileContent = useCallback((id: EditorId, content: string) => {
    setSnap(prev => {
      const cur = prev.files.get(id);
      if (!cur || cur.currentText === content) return prev;
      const next = new Map(prev.files);
      next.set(id, { ...cur, currentText: content, isDirty: content !== cur.savedContent });
      const updated = { ...prev, files: next };
      liveText.current.set(id, content);
      if (cur.visible) pushToScintilla(id, updated);
      return updated;
    });
  }, [pushToScintilla]);

  /** Add a new (empty, visible) file — upstream sidebar '+' flow. */
  const addFile = useCallback((id: EditorId) => {
    setSnap(prev => {
      if (prev.files.has(id)) return prev;
      const next = new Map(prev.files);
      next.set(id, {
        id,
        savedContent: '',
        currentText: '',
        language: detectLanguage(id),
        isDirty: false,
        visible: true,
      });
      return { ...prev, files: next, activeEditorId: id };
    });
  }, []);

  /** Permanently delete a file — upstream sidebar context-menu Delete. */
  const removeFile = useCallback((id: EditorId) => {
    flushEditor(id);
    liveText.current.delete(id);
    setSnap(prev => {
      if (!prev.files.has(id)) return prev;
      const next = new Map(prev.files);
      next.delete(id);
      const active = prev.activeEditorId === id ? (next.keys().next().value ?? null) : prev.activeEditorId;
      return { ...prev, files: next, activeEditorId: active };
    });
  }, [flushEditor]);

  /** Rename a file preserving content/visibility — upstream context-menu Rename. */
  const renameFile = useCallback((oldId: EditorId, newId: EditorId) => {
    flushEditor(oldId);
    liveText.current.delete(oldId);
    setSnap(prev => {
      const cur = prev.files.get(oldId);
      if (!cur || prev.files.has(newId)) return prev;
      const next = new Map<EditorId, typeof cur>();
      for (const [id, f] of prev.files.entries()) {
        if (id === oldId) next.set(newId, { ...f, id: newId, language: detectLanguage(newId) });
        else next.set(id, f);
      }
      const active = prev.activeEditorId === oldId ? newId : prev.activeEditorId;
      return { ...prev, files: next, activeEditorId: active };
    });
  }, [flushEditor]);

  return {
    snap,
    isEdited: isFiddleEdited(snap),
    selectEditor,
    showEditor,
    hideEditor,
    toggleEditor,
    resetLayout,
    markSaved,
    resetToTemplate,
    loadTemplate,
    loadSnapshot,
    flushAll,
    pushContent,
    addFile,
    removeFile,
    renameFile,
    setFileContent,
    values,
    persistNow,
  };
}
