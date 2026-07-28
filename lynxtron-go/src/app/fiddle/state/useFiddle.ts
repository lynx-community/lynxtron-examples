import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { scintillaApi, getExposed, foundationApi, appendFiddleOutput as appendOutput } from '../../store';
import { computeStyles, detectLanguage, LANG_TO_LSP_ID } from '../../syntax';
import {
  indicatorContainsBytePosition,
  markerToIndicator,
  packIndicators,
  type IndicatorRange,
} from '../../diagnostics';
import { arrayBufferToBase64, bytesToBase64 } from '../../shared/native-bridge-encoding';
import { stringRangeToUtf8ByteRange } from '../../shared/current-file-search';
import type { DiagnosticsMsg } from '../../../extension-host/types';
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
import { diagnosticUriForFiddleFile } from './fiddleDiagnostics';

const SESSION_KEY = 'fiddle.lastSession';
// All instances of this app share one config store (same app name), so a
// self-hosted child Fiddle would silently overwrite the parent's session.
// Single-writer lease: first instance claims it and heartbeats; later
// instances run with persistence read-only until the lease goes stale.
const WRITER_KEY = 'fiddle.session.writer';
const WRITER_STALE_MS = 5000;

interface FiddleDiagnosticRequest {
  uri: string;
  text: string;
  languageId: string;
}

interface FiddleDiagnosticIndicator extends IndicatorRange {
  message: string;
  severity: string;
}

function logFiddleDiagnostics(message: string): void {
  try { getExposed()?.utils?.log(`[Fiddle LS] ${message}`); } catch (_) {}
}

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
  /** Native-focused pane, falling back to the last active visible pane. */
  getFocusedEditorId: () => EditorId | null;
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
  /** Read the latest native text for one visible editor. */
  readEditorText: (id: EditorId) => string | null;
  /** Select a JavaScript string range without stealing focus from Fiddle UI. */
  selectEditorRange: (id: EditorId, start: number, end: number) => void;
  /** Push a file's state text, highlight, and diagnostics into its native editor. */
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
  const diagnosticTimers = useRef<Map<EditorId, any>>(new Map());
  const diagnosticVersions = useRef<Map<string, number>>(new Map());
  const lastDiagnosticRequests = useRef<Map<EditorId, FiddleDiagnosticRequest>>(new Map());
  const lastDiagnosticJson = useRef<Map<EditorId, string>>(new Map());
  const pendingDiagnostics = useRef<Set<EditorId>>(new Set());
  const diagnosticIndicators = useRef<Map<EditorId, FiddleDiagnosticIndicator[]>>(new Map());
  const indicatorApplicationPending = useRef<Set<EditorId>>(new Set());
  const activeCalltips = useRef<Map<EditorId, string>>(new Map());
  const lastPersisted = useRef<string | null>(null);
  // Live native text per visible editor. The 100ms poll updates THIS (a ref)
  // instead of React state — a setSnap per keystroke re-rendered the whole
  // Fiddle tree. React state only changes when a file's dirty flag flips;
  // currentText syncs on explicit flushes (save/run/hide/dialog) and the
  // persist tick folds live text in without touching state.
  const liveText = useRef<Map<EditorId, string>>(new Map());
  const lastFocusedEditorId = useRef<EditorId | null>(snap.activeEditorId);

  const getFocusedEditorId = useCallback((): EditorId | null => {
    const visibleIds = visibleEditorIds(snapRef.current);
    const api = scintillaApi();
    for (const id of visibleIds) {
      try {
        if (api?.hasFocus?.(scintillaIdFor(id))) {
          lastFocusedEditorId.current = id;
          return id;
        }
      } catch (_) {}
    }

    const remembered = lastFocusedEditorId.current;
    if (remembered && snapRef.current.files.get(remembered)?.visible) return remembered;
    const active = snapRef.current.activeEditorId;
    if (active && snapRef.current.files.get(active)?.visible) return active;
    return visibleIds[0] ?? null;
  }, []);

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

  const readEditorText = useCallback((id: EditorId): string | null => {
    const file = snapRef.current.files.get(id);
    if (!file?.visible) return null;
    return flushEditor(id) ?? liveText.current.get(id) ?? file.currentText;
  }, [flushEditor]);

  const selectEditorRange = useCallback((id: EditorId, start: number, end: number) => {
    const text = readEditorText(id);
    if (text == null) return;

    const { anchor, caret } = stringRangeToUtf8ByteRange(text, start, end);

    try {
      const api = scintillaApi();
      api?.setSelection?.(scintillaIdFor(id), anchor, caret);
      api?.scrollCaret?.(scintillaIdFor(id));
    } catch (_) {}
  }, [readEditorText]);

  const clearPaneDiagnostics = useCallback((id: EditorId) => {
    const timer = diagnosticTimers.current.get(id);
    if (timer) clearTimeout(timer);
    diagnosticTimers.current.delete(id);
    pendingDiagnostics.current.delete(id);

    const request = lastDiagnosticRequests.current.get(id);
    if (request) {
      try { getExposed()?.ls?.clearDiagnostics?.(request.uri); } catch (_) {}
    }
    lastDiagnosticRequests.current.delete(id);
    lastDiagnosticJson.current.delete(id);
    diagnosticIndicators.current.delete(id);
    indicatorApplicationPending.current.delete(id);
    activeCalltips.current.delete(id);

    const editorId = scintillaIdFor(id);
    try { scintillaApi()?.hideCalltip?.(editorId); } catch (_) {}
    try { scintillaApi()?.clearIndicators?.(editorId); } catch (_) {}
  }, []);

  useEffect(() => () => {
    for (const id of [...lastDiagnosticRequests.current.keys()]) clearPaneDiagnostics(id);
  }, [clearPaneDiagnostics]);

  const sendToLanguageService = useCallback((
    id: EditorId,
    text: string,
    snapshot: FiddleSnapshot,
  ): boolean => {
    const file = snapshot.files.get(id);
    const languageId = file ? LANG_TO_LSP_ID[file.language] : undefined;
    if (!file || !languageId) return false;

    const fsApi = foundationApi()?.fs;
    const uri = diagnosticUriForFiddleFile(snapshot, id, fsApi);
    if (!uri) return false;

    const ls = getExposed()?.ls;
    if (typeof ls?.updateFile !== 'function') return false;

    const previous = lastDiagnosticRequests.current.get(id);
    if (previous?.uri === uri && previous.text === text && previous.languageId === languageId) {
      pendingDiagnostics.current.delete(id);
      return true;
    }
    if (previous && previous.uri !== uri) {
      try { ls.clearDiagnostics?.(previous.uri); } catch (_) {}
    }

    // The preload cache is keyed only by URI. Remove the previous response
    // before sending a new version so the poller cannot repaint stale ranges.
    try { ls.clearDiagnostics?.(uri); } catch (_) {}
    lastDiagnosticJson.current.delete(id);

    const version = (diagnosticVersions.current.get(uri) ?? 0) + 1;
    diagnosticVersions.current.set(uri, version);
    try {
      ls.updateFile(uri, text, version, languageId);
      lastDiagnosticRequests.current.set(id, { uri, text, languageId });
      pendingDiagnostics.current.delete(id);
      logFiddleDiagnostics(`sent id=${id} lang=${languageId} version=${version}`);
      return true;
    } catch (error) {
      logFiddleDiagnostics(`send failed id=${id}: ${error}`);
      return false;
    }
  }, []);

  const scheduleDiagnostics = useCallback((id: EditorId, text: string) => {
    const existing = diagnosticTimers.current.get(id);
    if (existing) clearTimeout(existing);
    pendingDiagnostics.current.add(id);
    indicatorApplicationPending.current.delete(id);
    activeCalltips.current.delete(id);
    try { scintillaApi()?.hideCalltip?.(scintillaIdFor(id)); } catch (_) {}

    diagnosticTimers.current.set(id, setTimeout(() => {
      diagnosticTimers.current.delete(id);
      const latest = snapRef.current.files.get(id);
      if (!latest?.visible) {
        pendingDiagnostics.current.delete(id);
        return;
      }
      const currentText = liveText.current.get(id) ?? text;
      sendToLanguageService(id, currentText, snapRef.current);
    }, 500));
  }, [sendToLanguageService]);

  const applyPaneIndicators = useCallback((id: EditorId): boolean => {
    const indicators = diagnosticIndicators.current.get(id);
    const api = scintillaApi();
    if (!indicators || !api) return false;

    const editorId = scintillaIdFor(id);
    let result: boolean | undefined;
    try {
      if (indicators.length === 0) {
        result = api.clearIndicators?.(editorId);
      } else if (getExposed()?.platform === 'win32') {
        result = api.setIndicators?.(editorId, arrayBufferToBase64(packIndicators(indicators)));
      } else {
        result = api.setIndicators?.(editorId, packIndicators(indicators));
      }
    } catch (error) {
      logFiddleDiagnostics(`indicator apply failed id=${id}: ${error}`);
      result = false;
    }

    if (result === false) indicatorApplicationPending.current.add(id);
    else indicatorApplicationPending.current.delete(id);
    return result !== false;
  }, []);

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
      sendToLanguageService(id, text, snapshot);
      applyPaneIndicators(id);
    } catch (_) { /* not attached */ }
  }, [applyPaneIndicators, sendToLanguageService]);

  /** Push all visible files' content into their (possibly pending) native editors. */
  const pushAll = useCallback((snapshot: FiddleSnapshot) => {
    for (const [id, f] of snapshot.files.entries()) {
      if (f.visible) pushToScintilla(id, snapshot);
    }
  }, [pushToScintilla]);

  // ── Content, highlight, diagnostics, and dwell polling per visible pane. ──
  useEffect(() => {
    const timer = setInterval(() => {
      const api = scintillaApi();
      if (!api) return;
      const visibleIds = visibleEditorIds(snapRef.current);
      const focusedId = visibleIds.find(id => {
        try { return !!api.hasFocus?.(scintillaIdFor(id)); } catch (_) { return false; }
      }) ?? null;
      if (focusedId) {
        lastFocusedEditorId.current = focusedId;
        if (snapRef.current.activeEditorId !== focusedId) {
          setSnap(prev => (
            prev.activeEditorId === focusedId
              ? prev
              : { ...prev, activeEditorId: focusedId }
          ));
        }
      }

      for (const id of visibleIds) {
        const f = snapRef.current.files.get(id);
        if (!f) continue;
        const editorId = scintillaIdFor(id);

        let changed = false;
        try { changed = !!api.hasContentChanged(editorId); } catch (_) { continue; }
        let text = liveText.current.get(id) ?? f.currentText;
        if (changed) {
          try {
            const current = api.getText(editorId);
            if (typeof current !== 'string') continue;
            text = current;
          } catch (_) { continue; }

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

          // Debounce re-highlight and language-service updates independently.
          const timers = highlightTimers.current;
          const existing = timers.get(id);
          if (existing) clearTimeout(existing);
          const captured = text;
          timers.set(id, setTimeout(() => {
            timers.delete(id);
            const latest = snapRef.current.files.get(id);
            if (latest?.visible) pushHighlight(id, liveText.current.get(id) ?? captured, latest.language);
          }, 150));
          scheduleDiagnostics(id, text);
        } else if (!lastDiagnosticRequests.current.has(id)) {
          // Initial content may have been pushed before the preload bridge was
          // ready. Retry from the poller until the first request is accepted.
          sendToLanguageService(id, text, snapRef.current);
        }

        // Apply the newest diagnostics only when no newer edit is waiting for
        // its debounce. This prevents stale ranges flashing after a keystroke.
        const request = lastDiagnosticRequests.current.get(id);
        if (request && !pendingDiagnostics.current.has(id)) {
          try {
            const json: string | null = getExposed()?.ls?.getDiagnostics?.(request.uri) ?? null;
            if (json && json !== lastDiagnosticJson.current.get(id)) {
              const message: DiagnosticsMsg = JSON.parse(json);
              if (message.uri === request.uri) {
                lastDiagnosticJson.current.set(id, json);
                const indicators = message.markers.map(marker => markerToIndicator(request.text, marker));
                const enriched = indicators.map((indicator, index) => ({
                  ...indicator,
                  message: message.markers[index].message,
                  severity: message.markers[index].severity,
                }));
                diagnosticIndicators.current.set(id, enriched);
                applyPaneIndicators(id);
                logFiddleDiagnostics(`received id=${id} markers=${message.markers.length}`);
              }
            }
          } catch (error) {
            logFiddleDiagnostics(`poll failed id=${id}: ${error}`);
          }
        }

        if (indicatorApplicationPending.current.has(id)
          && !pendingDiagnostics.current.has(id)) {
          applyPaneIndicators(id);
        }

        // Preserve the legacy IDE's diagnostic hover behavior for each pane.
        try {
          const dwell = api.getDwellInfo?.(editorId);
          const markers = pendingDiagnostics.current.has(id)
            ? []
            : diagnosticIndicators.current.get(id) ?? [];
          const hit = dwell?.active
            ? markers.find(marker => indicatorContainsBytePosition(marker, dwell.bytePos))
            : undefined;
          const activeMessage = activeCalltips.current.get(id) ?? '';
          if (hit && activeMessage !== hit.message) {
            const shown = api.showCalltip?.(editorId, hit.start, hit.message);
            if (shown !== false) {
              activeCalltips.current.set(id, hit.message);
              logFiddleDiagnostics(`calltip shown id=${id} byte=${dwell.bytePos} message=${hit.message}`);
            }
          } else if (!hit && activeMessage) {
            activeCalltips.current.delete(id);
            api.hideCalltip?.(editorId);
          }
        } catch (_) { /* pane may be between detach and reattach */ }
      }
    }, 100);
    return () => {
      clearInterval(timer);
      for (const t of highlightTimers.current.values()) clearTimeout(t);
      highlightTimers.current.clear();
      for (const t of diagnosticTimers.current.values()) clearTimeout(t);
      diagnosticTimers.current.clear();
    };
  }, [applyPaneIndicators, scheduleDiagnostics, sendToLanguageService]);

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
    pushToScintilla(id, snapRef.current);
  }, [pushToScintilla, setVisible]);

  const hideEditor = useCallback((id: EditorId) => {
    // Native buffer dies with the pane — capture live text first.
    flushEditor(id);
    clearPaneDiagnostics(id);
    setVisible(id, false);
  }, [clearPaneDiagnostics, flushEditor, setVisible]);

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
    const visibleAfterReset = defaultVisibleIds(snapRef.current.files);
    for (const id of visibleEditorIds(snapRef.current)) {
      if (!visibleAfterReset.has(id)) clearPaneDiagnostics(id);
    }
    setSnap(prev => {
      const show = defaultVisibleIds(prev.files);
      const next = new Map(prev.files);
      for (const [id, f] of prev.files.entries()) {
        const shouldShow = show.has(id);
        if (f.visible !== shouldShow) next.set(id, { ...f, visible: shouldShow });
      }
      return { ...prev, files: next };
    });
  }, [clearPaneDiagnostics, flushAll]);

  const selectEditor = useCallback((id: EditorId) => {
    // Sidebar click: focus the file; if hidden, show it first (upstream setFocusedFile).
    const f = snapRef.current.files.get(id);
    const wasHidden = !!f && !f.visible;
    lastFocusedEditorId.current = id;
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
    for (const id of snapRef.current.files.keys()) clearPaneDiagnostics(id);
    liveText.current.clear();
    setSnap(fresh);
    snapRef.current = fresh;
    pushAll(fresh);
  }, [clearPaneDiagnostics, pushAll]);

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
    clearPaneDiagnostics(id);
    liveText.current.delete(id);
    setSnap(prev => {
      if (!prev.files.has(id)) return prev;
      const next = new Map(prev.files);
      next.delete(id);
      const active = prev.activeEditorId === id ? (next.keys().next().value ?? null) : prev.activeEditorId;
      return { ...prev, files: next, activeEditorId: active };
    });
  }, [clearPaneDiagnostics, flushEditor]);

  /** Rename a file preserving content/visibility — upstream context-menu Rename. */
  const renameFile = useCallback((oldId: EditorId, newId: EditorId) => {
    flushEditor(oldId);
    clearPaneDiagnostics(oldId);
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
  }, [clearPaneDiagnostics, flushEditor]);

  return {
    snap,
    isEdited: isFiddleEdited(snap),
    getFocusedEditorId,
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
    readEditorText,
    selectEditorRange,
    pushContent,
    addFile,
    removeFile,
    renameFile,
    setFileContent,
    values,
    persistNow,
  };
}
