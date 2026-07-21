import { useCallback, useState, useEffect, useRef } from '@lynx-js/react'; // eslint-disable-line
import './App.css';
import { detectLanguage, computeStyles, LANG_TO_LSP_ID, type Language } from './syntax';
import { markerToIndicator, packIndicators } from './diagnostics';
import type { DiagnosticsMsg } from '../extension-host/types';
import {
  type Tab,
  type TreeNode,
  type ShowcaseEntry,
  HIDDEN,
  EDITOR_ID,
  getExposed,
  scintillaApi,
  showcaseApi,
  exampleArtifactApi,
  SHOWCASE_REGISTRY,
  SHOWCASE_LOCAL_WORKSPACE,
  appendOutput,
  appendProcessLine,
  ensureProcessLogPolling,
  readProcessLogSince,
  subscribeProcessLog,
  foundationApi,
} from './store';
import { pickDefaultFile } from './ide/default-file';
import {
  buildExampleArtifactWorkspaceView,
  buildExampleArtifactLoadingState,
  buildExampleArtifactRunContext,
  type ExampleArtifactFetchResult,
  type ExampleArtifactMetadata,
  type ExampleArtifactLoadingState,
} from './shared/example-artifact';
import {
  canNavigateRouteBack,
  canNavigateRouteForward,
  createRouteNavigationState,
  createWorkspaceRouteSnapshot,
  enterHomeRoute,
  enterWorkspaceRoute,
  navigateRouteBack,
  navigateRouteForward,
  type RouteNavigationState,
} from './shared/navigation';
import {
  createFolderWorkspaceSession,
  createRouteFromWorkspaceSession,
  createShowcaseWorkspaceSession,
  createExampleArtifactWorkspaceSession,
  resolveWorkspaceRunTarget,
  setWorkspaceSessionActiveFile,
  type ResumableWorkspaceSession,
  type WorkspaceSession,
} from './shared/workspace-session';
import { getDeepLinkBridge } from './shared/deep-link-bridge';
import { registerShowcaseCommands } from './commands/showcase-commands';
import {
  resolveDeepLinkDispatchAction,
  type DeepLinkDispatchAction,
} from './shared/deep-link-dispatch';
import { checkDeepLinkActionReadiness } from './shared/deep-link-runtime';
import { registerStatusBarItem } from './components/StatusBar/statusbar-registry';
import { QuickPicker } from './components/QuickPicker/QuickPicker';
import { GalleryHome } from './components/Gallery/GalleryHome';
import { Fiddle } from './fiddle/Fiddle';
import { DEV_PRESET, isDevMode, drainCommandFile } from './fiddle/dev-preset';
import { isDarkTheme } from './fiddle/theme';
import { LoadingOverlay } from './components/shared/LoadingOverlay';
// Fiddle is the main page; the legacy IDE shell stays mountable behind the
// gallery's per-card "IDE" action (old open-showcase-in-workspace route).
import { IDE } from './components/IDE/IDE';
import { RouteNavigationControls } from './components/IDE/RouteNavigationControls';
import { CurrentFileFindBar } from './components/FindBar/CurrentFileFindBar';
import {
  findCurrentFileMatches,
  getWrappedMatchIndex,
  type CurrentFileMatch,
} from './shared/current-file-search';
import { arrayBufferToBase64, bytesToBase64 } from './shared/native-bridge-encoding';
import { buildShowcaseIdeDeepLink, type DeepLinkFileNavigation, type HostDeepLinkPayload } from '../shared/deep-link';

const DEEP_LINK_STARTUP_RETRY_DELAY_MS = 160;
const DEEP_LINK_APPLY_RETRY_DELAY_MS = 160;
const EXAMPLE_FETCH_BRIDGE_TIMEOUT_MS = 30000;
const SHOWCASE_LOADING_MIN_VISIBLE_MS = 900;

type PendingDeepLinkAction = {
  action: DeepLinkDispatchAction;
  source: string;
};

interface ShowcaseLoadingState {
  message: string;
  minVisibleMs: number;
}

interface ResolvedDeepLinkEditorNavigation {
  line: number; // 0-based
  column: number; // 0-based, clamped to line length
  selectLength: number;
  appliedLine: number; // 1-based
  appliedColumn: number; // 1-based
}

interface CurrentFileFindState {
  visible: boolean;
  query: string;
  matches: CurrentFileMatch[];
  activeMatchIndex: number;
  tabId: string | null;
}

function joinWorkspaceRootAndRelativeFile(rootPath: string, filePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, '')}/${filePath.replace(/^\/+/, '')}`;
}

function clampDeepLinkEditorNavigation(
  text: string,
  navigation: DeepLinkFileNavigation,
): ResolvedDeepLinkEditorNavigation {
  const lines = text.split('\n');
  const targetLine = Math.min(
    Math.max((navigation.line ?? 1) - 1, 0),
    Math.max(lines.length - 1, 0),
  );
  const lineText = lines[targetLine] || '';
  const targetColumn = Math.min(
    Math.max((navigation.column ?? 1) - 1, 0),
    lineText.length,
  );
  return {
    line: targetLine,
    column: targetColumn,
    selectLength: lineText.length,
    appliedLine: targetLine + 1,
    appliedColumn: targetColumn + 1,
  };
}

// Load a persisted layout value from config, with a fallback default.
function loadLayoutValue<T>(key: string, defaultValue: T): T {
  try {
    const v = getExposed()?.config?.get(key);
    if (v !== null && v !== undefined) return v as T;
  } catch (_) {}
  return defaultValue;
}

export function App(props: { onRender?: () => void } = {}) {
  // Test-harness hook (see __tests__/index.test.tsx): fires once after the
  // first background-thread render.
  useEffect(() => { props.onRender?.(); }, []);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [routeNavigation, setRouteNavigation] = useState<RouteNavigationState<WorkspaceSession>>(
    () => createRouteNavigationState<WorkspaceSession>(),
  );
  const [sidebarPanel, setSidebarPanel] = useState<string>(() => loadLayoutValue('layout.sidebarPanel', 'explorer'));
  const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(() => loadLayoutValue('layout.bottomPanelOpen', false));
  const [sidebarRatio, setSidebarRatio] = useState<number>(() => loadLayoutValue('layout.sidebarRatio', 0.22));
  const [editorBottomRatio, setEditorBottomRatio] = useState<number>(() => loadLayoutValue('layout.editorBottomRatio', 0.65));
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [workspaceSession, setWorkspaceSession] = useState<WorkspaceSession | null>(null);
  const [lastWorkspaceSession, setLastWorkspaceSession] = useState<ResumableWorkspaceSession | null>(null);
  const [dirContents, setDirContents] = useState<Map<string, TreeNode[]>>(new Map());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('Ready');
  const [exampleArtifactLoading, setExampleArtifactLoading] = useState<ExampleArtifactLoadingState | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState<ShowcaseLoadingState | null>(null);
  // Quick file picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerMode, setPickerMode] = useState<'files' | 'commands' | 'showcases' | 'url' | 'bundleUrl' | 'example' | undefined>(undefined);
  const [runningPid, setRunningPid] = useState<number | null>(null);
  const [bottomPanelTab, setBottomPanelTab] = useState<string | undefined>(undefined);
  const [isGalleryOpen, setGalleryOpen] = useState(false);
  // Fiddle theme tokens live on `.IDE` as CSS variables; light theme swaps
  // them via this class (see App.css). Driven by fiddle.settings.theme.
  const [uiThemeDark, setUiThemeDark] = useState(() => isDarkTheme());
  // Showcase handed from the gallery's Open into the Fiddle (new chain).
  const [pendingShowcaseTemplate, setPendingShowcaseTemplate] = useState<ShowcaseEntry | null>(null);
  // Legacy chain: mount the old IDE shell for the current workspace route.
  const [legacyIdeOpen, setLegacyIdeOpen] = useState(false);
  const [currentFileFind, setCurrentFileFind] = useState<CurrentFileFindState>({
    visible: false,
    query: '',
    matches: [],
    activeMatchIndex: -1,
    tabId: null,
  });
  const [currentFileFindFocusKey, setCurrentFileFindFocusKey] = useState(0);
  const route = routeNavigation.currentRoute;

  // Refs for use inside callbacks without stale closures
  const activeTabIdRef = useRef<string | null>(null);
  const tabsRef = useRef<Tab[]>([]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  const workspaceSessionRef = useRef<WorkspaceSession | null>(null);
  useEffect(() => { workspaceSessionRef.current = workspaceSession; }, [workspaceSession]);

  // Debounce refs for layout persistence
  const saveRatioDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exampleArtifactLoadingStartedAtRef = useRef(0);
  const exampleArtifactLoadingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exampleArtifactLoadingMinVisibleMsRef = useRef(0);
  const showcaseLoadingStartedAtRef = useRef(0);
  const showcaseLoadingClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showcaseLoadingMinVisibleMsRef = useRef(0);
  const deepLinkStartupRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkApplyRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeepLinkActionRef = useRef<PendingDeepLinkAction | null>(null);

  const readActiveEditorText = useCallback((): string => {
    const tabId = activeTabIdRef.current;
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (!tab) return '';
    try {
      const text: string = scintillaApi()?.getText(EDITOR_ID);
      if (text || text === '') return text;
    } catch (_) {}
    return tab.currentText ?? tab.savedContent ?? '';
  }, []);

  const saveLayout = useCallback((key: string, value: unknown) => {
    try { getExposed()?.config?.set(key, value); } catch (_) {}
  }, []);

  const debouncedSaveRatio = useCallback((key: string, value: number) => {
    if (saveRatioDebounceRef.current) clearTimeout(saveRatioDebounceRef.current);
    saveRatioDebounceRef.current = setTimeout(() => saveLayout(key, value), 300);
  }, [saveLayout]);

  const clearExampleArtifactLoading = useCallback((immediate = false) => {
    if (exampleArtifactLoadingClearTimeoutRef.current) {
      clearTimeout(exampleArtifactLoadingClearTimeoutRef.current);
      exampleArtifactLoadingClearTimeoutRef.current = null;
    }
    if (immediate) {
      exampleArtifactLoadingStartedAtRef.current = 0;
      exampleArtifactLoadingMinVisibleMsRef.current = 0;
      setExampleArtifactLoading(null);
      return;
    }
    const startedAt = exampleArtifactLoadingStartedAtRef.current;
    const minVisibleMs = exampleArtifactLoadingMinVisibleMsRef.current;
    if (startedAt <= 0 || minVisibleMs <= 0) {
      exampleArtifactLoadingStartedAtRef.current = 0;
      exampleArtifactLoadingMinVisibleMsRef.current = 0;
      setExampleArtifactLoading(null);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(minVisibleMs - elapsed, 0);
    if (remaining === 0) {
      exampleArtifactLoadingStartedAtRef.current = 0;
      exampleArtifactLoadingMinVisibleMsRef.current = 0;
      setExampleArtifactLoading(null);
      return;
    }
    exampleArtifactLoadingClearTimeoutRef.current = setTimeout(() => {
      exampleArtifactLoadingClearTimeoutRef.current = null;
      exampleArtifactLoadingStartedAtRef.current = 0;
      exampleArtifactLoadingMinVisibleMsRef.current = 0;
      setExampleArtifactLoading(null);
    }, remaining);
  }, []);

  const startExampleArtifactLoading = useCallback((loading: ExampleArtifactLoadingState) => {
    if (exampleArtifactLoadingClearTimeoutRef.current) {
      clearTimeout(exampleArtifactLoadingClearTimeoutRef.current);
      exampleArtifactLoadingClearTimeoutRef.current = null;
    }
    exampleArtifactLoadingStartedAtRef.current = Date.now();
    exampleArtifactLoadingMinVisibleMsRef.current = loading.minVisibleMs;
    setExampleArtifactLoading(loading);
  }, []);

  const clearShowcaseLoading = useCallback((immediate = false) => {
    if (showcaseLoadingClearTimeoutRef.current) {
      clearTimeout(showcaseLoadingClearTimeoutRef.current);
      showcaseLoadingClearTimeoutRef.current = null;
    }
    if (immediate) {
      showcaseLoadingStartedAtRef.current = 0;
      showcaseLoadingMinVisibleMsRef.current = 0;
      setShowcaseLoading(null);
      return;
    }
    const startedAt = showcaseLoadingStartedAtRef.current;
    const minVisibleMs = showcaseLoadingMinVisibleMsRef.current;
    if (startedAt <= 0 || minVisibleMs <= 0) {
      showcaseLoadingStartedAtRef.current = 0;
      showcaseLoadingMinVisibleMsRef.current = 0;
      setShowcaseLoading(null);
      return;
    }
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(minVisibleMs - elapsed, 0);
    if (remaining === 0) {
      showcaseLoadingStartedAtRef.current = 0;
      showcaseLoadingMinVisibleMsRef.current = 0;
      setShowcaseLoading(null);
      return;
    }
    showcaseLoadingClearTimeoutRef.current = setTimeout(() => {
      showcaseLoadingClearTimeoutRef.current = null;
      showcaseLoadingStartedAtRef.current = 0;
      showcaseLoadingMinVisibleMsRef.current = 0;
      setShowcaseLoading(null);
    }, remaining);
  }, []);

  const startShowcaseLoading = useCallback((message: string) => {
    if (showcaseLoadingClearTimeoutRef.current) {
      clearTimeout(showcaseLoadingClearTimeoutRef.current);
      showcaseLoadingClearTimeoutRef.current = null;
    }
    showcaseLoadingStartedAtRef.current = Date.now();
    showcaseLoadingMinVisibleMsRef.current = SHOWCASE_LOADING_MIN_VISIBLE_MS;
    setShowcaseLoading({ message, minVisibleMs: SHOWCASE_LOADING_MIN_VISIBLE_MS });
  }, []);

  // Pending load: when scintilla-view mounts after first tab opens, load queued file
  const pendingLoadRef = useRef<{ fullPath: string; lang: Language } | null>(null);

  // Real-time highlighting state
  const lastHighlightedTextRef = useRef<string>('');
  const highlightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabLangRef = useRef<Language>('Plain Text');

  // Language service state
  const lsDebounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lsVersionRef     = useRef(0);
  const activeTabPathRef = useRef<string>('');
  // Track the last diagnostics JSON we applied so we don't reapply identical data
  const lastDiagJsonRef  = useRef<string>('');
  // Markers with byte ranges + messages for hover lookup
  const currentMarkersRef = useRef<Array<{ start: number; length: number; style: number; message: string; severity: string }>>([]);
  // Track active calltip message to avoid redundant showCalltip calls
  const calltipActiveRef = useRef<string>('');


  // ── Logging ────────────────────────────────────────────────────────────────
  const log = useCallback((msg: string) => {
    try {
      getExposed()?.utils?.log(msg);
      // 根据官方文档，使用 NativeModules.bridge.send 发送单向通知到 main.ts
      // @ts-ignore
      NativeModules.bridge.send('logFromUi', { message: msg });
    } catch (_) { /* logging must never throw into callers */ }
  }, []);

  // ── Syntax highlighting ────────────────────────────────────────────────────
  const applyHighlight = useCallback((text: string, lang: Language) => {
    try {
      const styles = computeStyles(text, lang);
      if (getExposed()?.platform === 'win32') {
        scintillaApi()?.setStyles(EDITOR_ID, 0, bytesToBase64(styles));
      } else {
        scintillaApi()?.setStyles(EDITOR_ID, 0, styles.buffer);
      }
    } catch (e) {
      log(`highlight error: ${e}`);
    }
  }, [log]);

  // ── Set text into Scintilla and apply highlighting ────────────────────────
  const setEditorText = useCallback((text: string, lang: Language): boolean => {
    try {
      const success: boolean = scintillaApi()?.setText(EDITOR_ID, text);
      if (!success) { log(`setText failed`); return false; }
      applyHighlight(text, lang);
      lastHighlightedTextRef.current = text;
      activeTabLangRef.current = lang;
      return true;
    } catch (e) {
      log(`setEditorText error: ${e}`);
      return false;
    }
  }, [log, applyHighlight]);

  // ── Load file content from disk into Scintilla ──────────────────────────
  const loadFileIntoEditor = useCallback((fullPath: string, lang: Language): string | null => {
    try {
      const text = getExposed().fs.readFile(fullPath);
      if (text == null) { log(`loadFile failed (unreadable): ${fullPath}`); return null; }
      if (!setEditorText(text, lang)) return null;
      return text;
    } catch (e) {
      log(`loadFile error: ${e}`);
      return null;
    }
  }, [log, setEditorText]);

  // Re-attach + re-push the active tab's content into the native editor. Called
  // once after the scintilla-view's first layout. Two problems are healed here:
  //  1. detach asymmetry — the effect below detaches the editor whenever we are
  //     not in a workspace (Fiddle/gallery). On an IDE-boot instance the Fiddle
  //     shows first, so a detach is issued before `main-editor` even registers;
  //     the registry honors that pending detach on register, leaving
  //     detached_by_host_=true so OnLayoutChanged's lazy attach is skipped
  //     (blank pane). attachToWindow clears the flag and force-attaches.
  //  2. paint race — content applied before the view's first attach/paint lands
  //     in the document but doesn't repaint. setText is idempotent, so
  //     re-pushing identical text only forces the paint.
  const repushActiveEditor = useCallback(() => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const tab = tabsRef.current.find(t => t.id === id);
    if (!tab) return;
    log(`[IDE] repushActiveEditor: ${tab.name}`);
    try { scintillaApi()?.attachToWindow?.(EDITOR_ID); } catch (_) { /* ignore */ }
    setEditorText(tab.currentText, tab.language);
    try { scintillaApi()?.gotoLine?.(EDITOR_ID, 0); } catch (_) { /* ignore */ }
  }, [log, setEditorText]);

  // ── Snapshot current editor text into active tab state ────────────────────
  // Captures the live Scintilla text so unsaved edits survive tab switches.
  const snapshotCurrentTab = useCallback(() => {
    const tabId = activeTabIdRef.current;
    if (!tabId) return;
    try {
      const text: string = scintillaApi()?.getText(EDITOR_ID);
      if (!text && text !== '') return;
      log(`[IDE] snapshot tab=${tabId} len=${text.length} dirty=${text !== tabsRef.current.find(t => t.id === tabId)?.savedContent}`);
      setTabs(prev => {
        const next = prev.map(t =>
          t.id === tabId ? { ...t, currentText: text, isDirty: text !== t.savedContent } : t
        );
        tabsRef.current = next;
        return next;
      });
    } catch (e) {
      log(`snapshot error: ${e}`);
    }
  }, [log]);

  // After scintilla-view mounts (activeTabId transitions from null → id), load queued file
  useEffect(() => {
    if (!activeTabId || !pendingLoadRef.current) return;
    const { fullPath, lang } = pendingLoadRef.current;
    pendingLoadRef.current = null;
    loadFileIntoEditor(fullPath, lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // Keep activeTabLangRef and activeTabPathRef in sync with the active tab
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    activeTabLangRef.current = tab?.language || 'Plain Text';
    activeTabPathRef.current = tab?.fullPath || '';
  }, [activeTabId, tabs]);

  const currentRootPath = route.kind === 'workspace' ? route.rootPath : '';
  const lastWorkspacePath = lastWorkspaceSession?.rootPath ?? null;

  // ── Language service: send text to Extension Host for diagnostics ──────────
  const sendToLanguageService = useCallback((text: string, lang: Language, fullPath: string) => {
    const languageId = LANG_TO_LSP_ID[lang];
    if (!languageId || !fullPath) return;
    log(`[LS] sendToLS lang=${lang} id=${languageId}`);
    try {
      getExposed()?.ls?.updateFile(fullPath, text, ++lsVersionRef.current, languageId);
    } catch (e) {
      log(`[LS] updateFile error: ${e}`);
    }
  }, [log]);

  // ── Real-time syntax highlighting (SCN_MODIFIED flag + poll) ─────────────
  useEffect(() => {
    if (!activeTabId) return;

    const interval = setInterval(() => {
      // ── Section 1: content change → highlight + LS debounce ────────────────
      try {
        const changed: boolean = scintillaApi()?.hasContentChanged(EDITOR_ID);
        if (changed) {
          const text: string = scintillaApi()?.getText(EDITOR_ID);
          if (text !== undefined && text !== null) {
            const tab = tabsRef.current.find(t => t.id === activeTabId);
            if (tab) {
              const isDirty = text !== tab.savedContent;
              if (isDirty !== tab.isDirty) {
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isDirty } : t));
              }
            }

            if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
            const captured = text;
            highlightDebounceRef.current = setTimeout(() => {
              lastHighlightedTextRef.current = captured;
              applyHighlight(captured, activeTabLangRef.current);
            }, 50);

            if (lsDebounceRef.current) clearTimeout(lsDebounceRef.current);
            lsDebounceRef.current = setTimeout(() => {
              sendToLanguageService(captured, activeTabLangRef.current, activeTabPathRef.current);
            }, 500);
          }
        }
      } catch (_) { /* editor not yet ready */ }

      // ── Section 2: poll diagnostics from preload (independent of content change) ──
      try {
        const uri = activeTabPathRef.current;
        if (uri) {
          const json: string | null = getExposed()?.ls?.getDiagnostics(uri) ?? null;
          if (json && json !== lastDiagJsonRef.current) {
            lastDiagJsonRef.current = json;
            const msg: DiagnosticsMsg = JSON.parse(json);
            const text = lastHighlightedTextRef.current;
            const indicators = msg.markers.map(m => markerToIndicator(text, m));
            currentMarkersRef.current = indicators.map((ind, i) => ({
              ...ind,
              message: msg.markers[i].message,
              severity: msg.markers[i].severity,
            }));
            log(`[LS] diagnostics received: ${msg.markers.length} markers, ${indicators.length} indicators`);
            if (indicators.length === 0) {
              scintillaApi()?.clearIndicators(EDITOR_ID);
            } else if (getExposed()?.platform === 'win32') {
              scintillaApi()?.setIndicators(EDITOR_ID, arrayBufferToBase64(packIndicators(indicators)));
            } else {
              scintillaApi()?.setIndicators(EDITOR_ID, packIndicators(indicators));
            }
          }
        }
      } catch (e) { log(`[LS] diagnostics poll error: ${e}`); }

      // ── Section 3: poll dwell info → show/hide Scintilla calltip ─────────
      try {
        const di: { active: boolean; bytePos: number; x: number; y: number } | undefined =
          scintillaApi()?.getDwellInfo(EDITOR_ID);
        if (di?.active) {
          const markers = currentMarkersRef.current;
          const hit = markers.find(m => di.bytePos >= m.start && di.bytePos < m.start + m.length);
          if (hit) {
            if (calltipActiveRef.current !== hit.message) {
              calltipActiveRef.current = hit.message;
              scintillaApi()?.showCalltip(EDITOR_ID, hit.start, hit.message);
              log(`[Dwell] showCalltip bytePos=${hit.start} msg="${hit.message}"`);
            }
          } else {
            if (calltipActiveRef.current !== '') {
              calltipActiveRef.current = '';
              scintillaApi()?.hideCalltip(EDITOR_ID);
            }
          }
        } else {
          if (calltipActiveRef.current !== '') {
            calltipActiveRef.current = '';
            scintillaApi()?.hideCalltip(EDITOR_ID);
          }
        }
      } catch (e) { log(`[Dwell] error: ${e}`); }
    }, 100);

    return () => {
      clearInterval(interval);
      if (highlightDebounceRef.current) clearTimeout(highlightDebounceRef.current);
      if (lsDebounceRef.current) clearTimeout(lsDebounceRef.current);
    };
  }, [activeTabId, applyHighlight, sendToLanguageService]);

  const rememberWorkspaceSession = useCallback((session: ResumableWorkspaceSession) => {
    setLastWorkspaceSession(session);
    try {
      getExposed()?.config?.set('lastFolder', session.rootPath);
      getExposed()?.config?.set('lastWorkspaceSource', session.kind);
    } catch (_) {}
  }, []);

  const applyWorkspaceSession = useCallback((session: WorkspaceSession) => {
    const snapshot = createWorkspaceRouteSnapshot(createRouteFromWorkspaceSession(session), session);
    if (!snapshot) return;
    workspaceSessionRef.current = session;
    setWorkspaceSession(session);
    setRouteNavigation(prev => enterWorkspaceRoute(prev, snapshot));
  }, []);

  const syncWorkspaceSessionActiveFile = useCallback((activeFile?: string) => {
    const currentSession = workspaceSessionRef.current;
    if (!currentSession) return;
    const nextSession = setWorkspaceSessionActiveFile(currentSession, activeFile);
    if (nextSession === currentSession) return;
    const snapshot = createWorkspaceRouteSnapshot(createRouteFromWorkspaceSession(nextSession), nextSession);
    if (!snapshot) return;
    workspaceSessionRef.current = nextSession;
    setWorkspaceSession(nextSession);
    setRouteNavigation(prev => enterWorkspaceRoute(prev, snapshot));
  }, []);

  // ── Open folder ────────────────────────────────────────────────────────────
  const openFolder = useCallback((folderPath: string, source: 'folder' | 'showcase' = 'folder') => {
    console.log('[IDE] openFolder called with:', folderPath);
    log(`[IDE] openFolder: ${folderPath}`);
    try {
      const exposed = getExposed();
      if (!exposed) {
        const msg = 'openFolder: getExposed() returned null — preload not ready';
        console.error('[IDE]', msg);
        log(msg);
        setStatus('Error: Node.js not ready');
        return;
      }
      const entries: Array<{ name: string; isDirectory: boolean }> =
        exposed.fs.readdirStat(folderPath);
      console.log('[IDE] openFolder entries count:', entries?.length);
      log(`[IDE] openFolder entries: ${entries?.length}`);
      const nodes: TreeNode[] = entries
        .filter(e => !HIDDEN.has(e.name))
        .map(e => ({ name: e.name, fullPath: `${folderPath}/${e.name}`, isDirectory: e.isDirectory }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
      const session = source === 'showcase'
        ? createShowcaseWorkspaceSession(folderPath)
        : createFolderWorkspaceSession(folderPath);
      applyWorkspaceSession(session);
      setDirContents(new Map([[folderPath, nodes]]));
      setExpandedDirs(new Set([folderPath]));
      setStatus(`Opened ${folderPath.split('/').pop()}`);
      rememberWorkspaceSession(session);
    } catch (e) {
      console.error('[IDE] openFolder error:', e);
      log(`openFolder error: ${e}`);
      setStatus('Error opening folder');
    }
  }, [applyWorkspaceSession, createFolderWorkspaceSession, createShowcaseWorkspaceSession, log, rememberWorkspaceSession]);

  // Listen for global event from main.ts after showOpenDialog resolves
  useEffect(() => {
    const handler = (data: any) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed?.path) openFolder(parsed.path);
      } catch (_) { /* ignore */ }
    };
    try {
      // @ts-ignore
      lynx.getJSModule('GlobalEventEmitter').addListener('folderOpened', handler);
    } catch (_) { /* ignore */ }
    return () => {
      try {
        // @ts-ignore
        lynx.getJSModule('GlobalEventEmitter').removeListener('folderOpened', handler);
      } catch (_) {}
    };
  }, [openFolder]);


  // Auto-restore last workspace on startup
  useEffect(() => {
    try {
      const lastFolder: string | null = getExposed()?.config?.get('lastFolder');
      if (!lastFolder) return;
      const persistedSource = getExposed()?.config?.get('lastWorkspaceSource');
      const source = persistedSource === 'showcase' || persistedSource === 'folder'
        ? persistedSource
        : showcaseApi()?.isShowcase?.(lastFolder)
          ? 'showcase'
          : 'folder';
      setLastWorkspaceSession(
        source === 'showcase'
          ? createShowcaseWorkspaceSession(lastFolder)
          : createFolderWorkspaceSession(lastFolder),
      );
    } catch (_) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle directory in tree ───────────────────────────────────────────────
  const toggleDir = useCallback((dirPath: string) => {
    if (expandedDirs.has(dirPath)) {
      setExpandedDirs(prev => { const s = new Set(prev); s.delete(dirPath); return s; });
      return;
    }
    try {
      if (!dirContents.has(dirPath)) {
        const entries: Array<{ name: string; isDirectory: boolean }> =
          getExposed().fs.readdirStat(dirPath);
        const nodes: TreeNode[] = entries
          .filter(e => !HIDDEN.has(e.name))
          .map(e => ({ name: e.name, fullPath: `${dirPath}/${e.name}`, isDirectory: e.isDirectory }))
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
          });
        setDirContents(prev => new Map([...prev, [dirPath, nodes]]));
      }
      setExpandedDirs(prev => { const s = new Set(prev); s.add(dirPath); return s; });
    } catch (e) {
      log(`toggleDir error: ${e}`);
    }
  }, [expandedDirs, dirContents, log]);

  // ── Open file in tab ───────────────────────────────────────────────────────
  const openFile = useCallback((fullPath: string) => {
    log(`[IDE] openFile: ${fullPath}`);
    const existing = tabsRef.current.find(t => t.fullPath === fullPath);
    if (existing) {
      if (existing.id === activeTabIdRef.current) {
        syncWorkspaceSessionActiveFile(fullPath);
        return;
      }
      snapshotCurrentTab();
      // Use in-memory text if available (preserves unsaved edits)
      if (existing.currentText) {
        setEditorText(existing.currentText, existing.language);
        sendToLanguageService(existing.currentText, existing.language, fullPath);
      } else {
        const text = loadFileIntoEditor(fullPath, existing.language);
        if (text !== null) sendToLanguageService(text, existing.language, fullPath);
      }
      setActiveTabId(existing.id);
      syncWorkspaceSessionActiveFile(fullPath);
      setStatus(existing.name);
      return;
    }

    snapshotCurrentTab();

    const name = fullPath.split('/').pop() || fullPath;
    const lang = detectLanguage(name);

    if (!activeTabIdRef.current) {
      // readFile reports failure as null (it never throws across the bridge).
      const maybeText = getExposed().fs.readFile(fullPath);
      if (maybeText == null) { setStatus(`Failed to open ${name}`); return; }
      const text = maybeText;
      applyHighlight(text, lang);
      lastHighlightedTextRef.current = text;
      activeTabLangRef.current = lang;
      sendToLanguageService(text, lang, fullPath);
      pendingLoadRef.current = { fullPath, lang };
      const newTab: Tab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name, fullPath, savedContent: text, currentText: text, isDirty: false, language: lang,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      syncWorkspaceSessionActiveFile(fullPath);
      setStatus(name);
      return;
    }

    const text = loadFileIntoEditor(fullPath, lang);
    if (text === null) { setStatus(`Failed to open ${name}`); return; }
    sendToLanguageService(text, lang, fullPath);

    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, fullPath, savedContent: text, currentText: text, isDirty: false, language: lang,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    syncWorkspaceSessionActiveFile(fullPath);
    setStatus(name);
  }, [snapshotCurrentTab, loadFileIntoEditor, setEditorText, applyHighlight, sendToLanguageService, syncWorkspaceSessionActiveFile]);

  // ── Open file at specific line/selection (universal navigation primitive) ──
  const openFileAt = useCallback((fullPath: string, options?: {
    line?: number;        // 0-based line number
    column?: number;      // 0-based column
    selectLength?: number; // number of bytes to select from position
    highlightWholeLine?: boolean;
  }) => {
    openFile(fullPath);

    if (!options) return;

    // Defer navigation until after the editor has loaded the file.
    setTimeout(() => {
      try {
        const sci = scintillaApi();
        log(`[openFileAt] sci=${!!sci} line=${options.line} col=${options.column} selLen=${options.selectLength}`);
        if (!sci) return;

        const gotoResult = options.line !== undefined ? sci.gotoLine(EDITOR_ID, options.line) : 'skipped';
        log(`[openFileAt] gotoLine result=${gotoResult}`);

        if (options.highlightWholeLine || (options.selectLength && options.selectLength > 0)) {
          const text: string = sci.getText(EDITOR_ID);
          log(`[openFileAt] getText length=${text?.length}`);
          if (text) {
            const utf8Len = getExposed()?.utils?.utf8ByteLength;
            const lines = text.split('\n');
            let byteOffset = 0;
            const targetLine = Math.min(Math.max(options.line ?? 0, 0), Math.max(lines.length - 1, 0));
            for (let i = 0; i < targetLine && i < lines.length; i++) {
              byteOffset += (utf8Len ? utf8Len(lines[i]) : lines[i].length) + 1; // +1 for \n
            }
            const lineText = lines[targetLine] || '';
            const clampedColumn = Math.min(Math.max(options.column ?? 0, 0), lineText.length);
            const columnPrefix = lineText.substring(0, clampedColumn);
            const lineStart = byteOffset;
            const columnByteOffset = lineStart + (utf8Len ? utf8Len(columnPrefix) : columnPrefix.length);
            const anchor = options.highlightWholeLine ? lineStart : columnByteOffset;
            const matchText = options.highlightWholeLine
              ? lineText
              : lineText.substring(clampedColumn, clampedColumn + (options.selectLength ?? 0));
            const matchBytes = utf8Len ? utf8Len(matchText) : matchText.length;
            const caret = anchor + matchBytes;
            log(`[openFileAt] setSelection anchor=${anchor} caret=${caret}`);
            const selResult = sci.setSelection(EDITOR_ID, anchor, caret);
            log(`[openFileAt] setSelection result=${selResult}`);
          }
        }

        const scrollResult = sci.scrollCaret(EDITOR_ID);
        log(`[openFileAt] scrollCaret result=${scrollResult}`);
      } catch (e) {
        log(`[openFileAt] error: ${e}`);
      }
    }, 100);
  }, [openFile, log]);

  const selectCurrentFileMatch = useCallback((match: CurrentFileMatch) => {
    const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    if (!tab) return;
    openFileAt(tab.fullPath, {
      line: match.line,
      column: match.column,
      selectLength: match.end - match.start,
    });
  }, [openFileAt]);

  const refocusCurrentFileFind = useCallback(() => {
    setCurrentFileFindFocusKey(key => key + 1);
  }, []);

  const refreshCurrentFileFind = useCallback((query: string, preferredIndex = 0, shouldSelect = false) => {
    const tabId = activeTabIdRef.current;
    const matches = tabId ? findCurrentFileMatches(readActiveEditorText(), query) : [];
    const activeMatchIndex = matches.length > 0
      ? Math.min(Math.max(preferredIndex, 0), matches.length - 1)
      : -1;

    setCurrentFileFind(prev => ({
      ...prev,
      query,
      matches,
      activeMatchIndex,
      tabId,
    }));

    if (shouldSelect && query && activeMatchIndex >= 0) {
      selectCurrentFileMatch(matches[activeMatchIndex]);
      refocusCurrentFileFind();
    }
  }, [readActiveEditorText, refocusCurrentFileFind, selectCurrentFileMatch]);

  const openCurrentFileFind = useCallback(() => {
    if (route.kind !== 'workspace') return;
    const query = currentFileFind.query;
    const tabId = activeTabIdRef.current;
    const matches = tabId ? findCurrentFileMatches(readActiveEditorText(), query) : [];
    const activeMatchIndex = query && matches.length > 0 ? 0 : -1;
    setCurrentFileFind({
      visible: true,
      query,
      matches,
      activeMatchIndex,
      tabId,
    });
    refocusCurrentFileFind();
    if (query && activeMatchIndex >= 0) {
      selectCurrentFileMatch(matches[activeMatchIndex]);
    }
  }, [currentFileFind.query, readActiveEditorText, refocusCurrentFileFind, route.kind, selectCurrentFileMatch]);

  const closeCurrentFileFind = useCallback(() => {
    setCurrentFileFind({
      visible: false,
      query: '',
      matches: [],
      activeMatchIndex: -1,
      tabId: null,
    });
  }, []);

  const updateCurrentFileFindQuery = useCallback((query: string) => {
    refreshCurrentFileFind(query, 0, !!query);
  }, [refreshCurrentFileFind]);

  const navigateCurrentFileFind = useCallback((direction: 'next' | 'previous') => {
    const query = currentFileFind.query;
    if (!query) return;
    const tabId = activeTabIdRef.current;
    const matches = tabId ? findCurrentFileMatches(readActiveEditorText(), query) : [];
    const activeMatchIndex = getWrappedMatchIndex(
      currentFileFind.activeMatchIndex,
      matches.length,
      direction,
    );
    setCurrentFileFind(prev => ({
      ...prev,
      matches,
      activeMatchIndex,
      tabId,
    }));
    if (activeMatchIndex >= 0) {
      selectCurrentFileMatch(matches[activeMatchIndex]);
      refocusCurrentFileFind();
    }
  }, [currentFileFind.activeMatchIndex, currentFileFind.query, readActiveEditorText, refocusCurrentFileFind, selectCurrentFileMatch]);

  useEffect(() => {
    if (!currentFileFind.visible) return;
    refreshCurrentFileFind(currentFileFind.query, 0, !!currentFileFind.query);
    refocusCurrentFileFind();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // Keep this above deep-link file navigation callbacks; Lynx is strict about TDZ in hook deps.
  const showOutput = useCallback((level: 'info' | 'error' | 'warn', msg: string) => {
    appendOutput(level, msg);
    setBottomPanelOpen(true);
    setBottomPanelTab('output');
  }, []);

  // Mirror process output into the legacy IDE's output log. MUST read from
  // the shared store, never from readProcessOutput directly: that call DRAINS
  // the preload buffer and this loop used to race the console's poller and
  // steal most of its lines (Run/download output vanished from the console).
  // Subscription, not a second poll — the log lives in this JS context.
  useEffect(() => {
    ensureProcessLogPolling();
    let cursor = readProcessLogSince(0).cursor; // skip history, mirror new lines only
    return subscribeProcessLog(() => {
      try {
        const read = readProcessLogSince(cursor);
        cursor = read.cursor;
        for (const entry of read.entries) {
          const level = entry.stream === 'stderr' ? 'warn' : 'info';
          if (entry.message) appendOutput(level, entry.message);
        }
      } catch (_) {}
    });
  }, []);

  const openWorkspaceFileFromDeepLink = useCallback((
    rootPath: string,
    navigation: DeepLinkFileNavigation,
    sourceLabel: string,
  ): boolean => {
    const relativePath = navigation.filePath;
    const fullPath = joinWorkspaceRootAndRelativeFile(rootPath, relativePath);

    const maybeDeepLinkText = getExposed().fs.readFile(fullPath);
    if (maybeDeepLinkText == null) {
      const message = `Deep link file not found: ${relativePath}`;
      log(`[IDE] deep link file open failed path=${fullPath} source=${sourceLabel}`);
      showOutput('error', message);
      setStatus(message);
      return false;
    }

    if (navigation.line === undefined) {
      openFile(fullPath);
      showOutput('info', `Deep link opened file: ${relativePath} [${sourceLabel}]`);
      setStatus(`Opened ${relativePath}`);
      return true;
    }

    const resolved = clampDeepLinkEditorNavigation(maybeDeepLinkText, navigation);
    openFileAt(fullPath, {
      line: resolved.line,
      column: resolved.column,
      selectLength: resolved.selectLength,
      highlightWholeLine: true,
    });
    showOutput(
      'info',
      `Deep link opened file: ${relativePath}:${resolved.appliedLine}:${resolved.appliedColumn} [${sourceLabel}]`,
    );
    setStatus(`Opened ${relativePath}:${resolved.appliedLine}`);
    return true;
  }, [log, openFile, openFileAt, showOutput]);

  // ── Switch tab ─────────────────────────────────────────────────────────────
  const switchTab = useCallback((tabId: string) => {
    if (tabId === activeTabIdRef.current) {
      const currentTab = tabsRef.current.find(t => t.id === tabId);
      if (currentTab) {
        syncWorkspaceSessionActiveFile(currentTab.fullPath);
      }
      return;
    }
    snapshotCurrentTab();
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (!tab) return;
    try { scintillaApi()?.clearIndicators(EDITOR_ID); } catch (_) {}
    try { scintillaApi()?.hideCalltip(EDITOR_ID); } catch (_) {}
    lastDiagJsonRef.current = '';
    currentMarkersRef.current = [];
    calltipActiveRef.current = '';
    log(`[IDE] switchTab id=${tabId} hasCurrentText=${!!tab.currentText} len=${tab.currentText?.length}`);
    // Use in-memory text if available (preserves unsaved edits), fall back to disk
    if (tab.currentText) {
      setEditorText(tab.currentText, tab.language);
      sendToLanguageService(tab.currentText, tab.language, tab.fullPath);
    } else {
      const text = loadFileIntoEditor(tab.fullPath, tab.language);
      if (text !== null) sendToLanguageService(text, tab.language, tab.fullPath);
    }
    setActiveTabId(tabId);
    syncWorkspaceSessionActiveFile(tab.fullPath);
    setStatus(tab.name);
  }, [snapshotCurrentTab, loadFileIntoEditor, setEditorText, sendToLanguageService, log, syncWorkspaceSessionActiveFile]);

  // ── Close tab ──────────────────────────────────────────────────────────────
  const closeTab = useCallback((tabId: string) => {
    const currentTabs = tabsRef.current;
    const tab = currentTabs.find(t => t.id === tabId);
    if (!tab) return;

    const idx = currentTabs.findIndex(t => t.id === tabId);
    const newTabs = currentTabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabIdRef.current === tabId) {
      const next = newTabs[Math.min(idx, newTabs.length - 1)];
      if (next) {
        const text = loadFileIntoEditor(next.fullPath, next.language);
        if (text !== null) sendToLanguageService(text, next.language, next.fullPath);
        setActiveTabId(next.id);
        syncWorkspaceSessionActiveFile(next.fullPath);
        setStatus(next.name);
      } else {
        setActiveTabId(null);
        syncWorkspaceSessionActiveFile(undefined);
        setStatus('Ready');
      }
    }
  }, [loadFileIntoEditor, sendToLanguageService, syncWorkspaceSessionActiveFile]);

  const createCurrentWorkspaceRouteSnapshot = useCallback((session: WorkspaceSession) => {
    const activeTab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
    const nextSession = setWorkspaceSessionActiveFile(session, activeTab?.fullPath);
    return createWorkspaceRouteSnapshot(createRouteFromWorkspaceSession(nextSession), nextSession);
  }, []);

  const detachNativeEditorView = useCallback(() => {
    try { scintillaApi()?.hideCalltip(EDITOR_ID); } catch (_) {}
    try { scintillaApi()?.detachFromWindow?.(EDITOR_ID); } catch (_) {}
  }, []);

  const handleRouteBack = useCallback(() => {
    if (!canNavigateRouteBack(routeNavigation)) return;
    const currentSession = workspaceSessionRef.current;
    if (!currentSession) return;

    snapshotCurrentTab();
    const snapshot = createCurrentWorkspaceRouteSnapshot(currentSession);
    if (!snapshot) return;

    detachNativeEditorView();
    workspaceSessionRef.current = null;
    setWorkspaceSession(null);
    setRouteNavigation(prev => navigateRouteBack(prev, snapshot));
    setStatus('Opened Home');
  }, [createCurrentWorkspaceRouteSnapshot, detachNativeEditorView, routeNavigation, snapshotCurrentTab]);

  const handleRouteForward = useCallback(() => {
    const result = navigateRouteForward(routeNavigation);
    const restored = result.restoredWorkspace;
    if (!restored) return;

    workspaceSessionRef.current = restored.workspaceSession;
    setWorkspaceSession(restored.workspaceSession);
    setRouteNavigation(result.state);
    setStatus(`Restored ${restored.workspaceSession.rootPath.split('/').pop() || 'workspace'}`);
  }, [routeNavigation]);

  useEffect(() => {
    if (route.kind !== 'workspace' || !activeTabId) {
      detachNativeEditorView();
    }
  }, [activeTabId, detachNativeEditorView, route.kind]);

  useEffect(() => {
    if (route.kind !== 'workspace') return;
    const tabId = activeTabIdRef.current;
    if (!tabId) return;
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (!tab) return;

    const timeout = setTimeout(() => {
      setEditorText(tab.currentText, tab.language);
    }, 100);
    return () => clearTimeout(timeout);
  }, [route.kind, setEditorText]);

  // ── Capture window to base64 (for DevTool / AI inspection) ────────────────
  // Dev-only surfaces, same gate as the /tmp command channels: user builds
  // must not carry screenshot/open-file hooks on globalThis.
  useEffect(() => {
    if (!isDevMode()) return;
    try {
      // @ts-ignore
      globalThis.__ide_captureScreenshot = () => {
        try {
          const b64: string = scintillaApi()?.captureWindowToBase64();
          if (b64 && b64.length > 0) {
            log(`captureScreenshot OK, size=${Math.round(b64.length * 3 / 4)} bytes`);
            return b64;
          }
          const b64Full: string = getExposed().utils.screenshotToBase64();
          if (b64Full) log('captureScreenshot OK (full-screen fallback)');
          return b64Full || '';
        } catch (e) {
          log(`captureScreenshot error: ${e}`);
          return '';
        }
      };
      // @ts-ignore
      globalThis.__ide_captureToFile = () => {
        try {
          const ok: boolean = scintillaApi()?.captureWindow('/tmp/ide_screenshot.png');
          if (ok) { log('captureToFile OK \u2192 /tmp/ide_screenshot.png'); return true; }
          const ok2: boolean = getExposed().utils.screenshotToFile('/tmp/ide_screenshot.png');
          if (ok2) log('captureToFile OK (full-screen fallback) \u2192 /tmp/ide_screenshot.png');
          return ok2;
        } catch (e) {
          log(`captureToFile error: ${e}`);
          return false;
        }
      };
      // @ts-ignore
      globalThis.__ide_openFile = (path: string) => {
        log(`[IDE] __ide_openFile called: ${path}`);
        openFile(path);
      };
      // @ts-ignore
      globalThis.__ide_openFileAt = (path: string, line?: number, col?: number, selectLen?: number) => {
        log(`[IDE] __ide_openFileAt called: ${path} line=${line} col=${col} sel=${selectLen}`);
        openFileAt(path, { line, column: col, selectLength: selectLen });
      };
    } catch (_) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFile, openFileAt]);

  // ── Save current file ──────────────────────────────────────────────────────
  const saveCurrentFile = useCallback(() => {
    log(`[IDE] saveCurrentFile called, activeTab=${activeTabIdRef.current}`);
    const tabId = activeTabIdRef.current;
    if (!tabId) { log('[IDE] save: no active tab'); return; }
    const tab = tabsRef.current.find(t => t.id === tabId);
    if (!tab) { log('[IDE] save: tab not found'); return; }
    try {
      const text: string = scintillaApi()?.getText(EDITOR_ID);
      log(`[IDE] save: getText len=${text?.length} path=${tab.fullPath}`);
      if (!text && text !== '') { log('[IDE] save: getText empty/undefined'); return; }
      const ok: boolean = getExposed().fs.writeFile(tab.fullPath, text);
      log(`[IDE] save: writeFile returned ${ok}`);
      if (ok) {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, savedContent: text, currentText: text, isDirty: false } : t));
        setStatus(`Saved \u2014 ${tab.name}`);
      } else {
        setStatus(`Save failed \u2014 ${tab.name}`);
      }
    } catch (e) {
      log(`save error: ${e}`);
      setStatus('Save error');
    }
  }, [log]);

  // ── Open folder dialog ────────────────────────────────────────────────────
  const openFolderDialog = useCallback(() => {
    console.log('[IDE] openFolderDialog tapped');
    log('[IDE] openFolderDialog tapped');
    try {
      // @ts-ignore
      NativeModules.bridge.call('openFolder', {}, (result: any) => {
        console.log('[IDE] openFolder bridge callback:', JSON.stringify(result));
        log(`[IDE] openFolder callback: ${JSON.stringify(result)}`);
        if (result?.path) openFolder(result.path);
      });
    } catch (e) {
      console.error('[IDE] openFolderDialog error:', e);
      log(`openFolderDialog error: ${e}`);
    }
  }, [log, openFolder]);

  const startShowcaseList = useCallback(() => {
    setPickerQuery('');
    setPickerMode('showcases');
    setPickerOpen(true);
  }, []);

  const startUrlFetch = useCallback(() => {
    setPickerQuery('');
    setPickerMode('url');
    setPickerOpen(true);
  }, []);

  const startBundleUrlFetch = useCallback(() => {
    setPickerQuery('');
    setPickerMode('bundleUrl');
    setPickerOpen(true);
  }, []);

  const startExampleFetch = useCallback(() => {
    setPickerQuery('');
    setPickerMode('example');
    setPickerOpen(true);
  }, []);

  const handleResumeWorkspace = useCallback(() => {
    if (!lastWorkspaceSession) return;
    openFolder(lastWorkspaceSession.rootPath, lastWorkspaceSession.kind);
  }, [lastWorkspaceSession, openFolder]);

  // Register StatusBar items
  useEffect(() => {
    registerStatusBarItem({
      id: 'language',
      align: 'left',
      priority: 10,
      text: () => {
        const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
        return tab?.language || 'Plain Text';
      },
    });
    registerStatusBarItem({
      id: 'save',
      align: 'right',
      priority: 100,
      text: () => {
        const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
        if (!tab) return '';
        return tab.isDirty ? '\u25CF Save' : '\u2713 Saved';
      },
      onTap: () => saveCurrentFile(),
    });
  }, [saveCurrentFile]);

  // Register run status in StatusBar (re-registers when pid changes)
  useEffect(() => {
    registerStatusBarItem({
      id: 'run-status',
      align: 'left',
      priority: 20,
      text: () => runningPid ? `\u25B6 pid ${runningPid}` : '',
      visible: () => !!runningPid,
    });
  }, [runningPid]);

  // ── IDE commands from main.ts menu (Cmd+S / Cmd+W / Cmd+Shift+O / Cmd+P) ──
  // sendGlobalEvent dispatches via GlobalEventEmitter.emit but drops the data
  // payload, so we use per-command event names: ide:save, ide:closeTab, etc.
  useEffect(() => {
    // @ts-ignore
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const onSave = () => { log('[IDE] ide:save received'); saveCurrentFile(); };
    const onCloseTab = () => {
      log('[IDE] ide:closeTab received');
      const tabId = activeTabIdRef.current;
      if (tabId) closeTab(tabId);
    };
    const onOpenFolder = () => { log('[IDE] ide:openFolder received'); openFolderDialog(); };
    const onQuickOpen = () => { log('[IDE] ide:quickOpen received'); setPickerQuery(''); setPickerOpen(true); };
    const onTogglePanel = () => {
      log('[IDE] ide:togglePanel received');
      setBottomPanelOpen(v => { const next = !v; saveLayout('layout.bottomPanelOpen', next); return next; });
    };
    const onFindInFile = () => {
      log('[IDE] ide:findInFile received');
      openCurrentFileFind();
    };
    const onFindInFiles = () => {
      log('[IDE] ide:findInFiles received');
      setSidebarPanel('search');
      saveLayout('layout.sidebarPanel', 'search');
    };
    try {
      emitter.addListener('ide:save', onSave);
      emitter.addListener('ide:closeTab', onCloseTab);
      emitter.addListener('ide:openFolder', onOpenFolder);
      emitter.addListener('ide:quickOpen', onQuickOpen);
      emitter.addListener('ide:togglePanel', onTogglePanel);
      emitter.addListener('ide:findInFile', onFindInFile);
      emitter.addListener('ide:findInFiles', onFindInFiles);
      log('[IDE] ide:* listeners registered');
    } catch (e) { log(`[IDE] ide:* registration error: ${e}`); }
    return () => {
      try {
        emitter.removeListener('ide:save', onSave);
        emitter.removeListener('ide:closeTab', onCloseTab);
        emitter.removeListener('ide:openFolder', onOpenFolder);
        emitter.removeListener('ide:quickOpen', onQuickOpen);
        emitter.removeListener('ide:togglePanel', onTogglePanel);
        emitter.removeListener('ide:findInFile', onFindInFile);
        emitter.removeListener('ide:findInFiles', onFindInFiles);
      } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveCurrentFile, closeTab, openFolderDialog, openCurrentFileFind]);

  // ── Collect all files for Cmd+P picker ────────────────────────────────────
  const allFiles: TreeNode[] = [];
  for (const nodes of dirContents.values()) {
    for (const node of nodes) {
      if (!node.isDirectory) allFiles.push(node);
    }
  }
  const filteredFiles = pickerQuery
    ? allFiles.filter(f => {
        const q = pickerQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.fullPath.toLowerCase().includes(q);
      })
    : allFiles;

  const clearDeepLinkStartupRetry = useCallback(() => {
    if (!deepLinkStartupRetryTimeoutRef.current) return;
    clearTimeout(deepLinkStartupRetryTimeoutRef.current);
    deepLinkStartupRetryTimeoutRef.current = null;
  }, []);

  const clearDeepLinkApplyRetry = useCallback(() => {
    if (!deepLinkApplyRetryTimeoutRef.current) return;
    clearTimeout(deepLinkApplyRetryTimeoutRef.current);
    deepLinkApplyRetryTimeoutRef.current = null;
  }, []);

  const runBundleFileDirect = useCallback((bundlePath?: string) => {
    const trimmedPath = bundlePath?.trim() || '';
    const bridge = getDeepLinkBridge();
    if (!bridge?.call) {
      setStatus('Bundle file runner bridge unavailable');
      showOutput('error', 'Bundle file runner bridge unavailable');
      return;
    }
    if (trimmedPath) {
      showOutput('info', `Running bundle file: ${trimmedPath}`);
      setStatus(`Running bundle file: ${trimmedPath}`);
    } else {
      showOutput('info', 'Selecting local Lynx bundle file...');
      setStatus('Selecting local Lynx bundle file...');
    }
    try {
      log(`[IDE] runBundleFileDirect bridge call: ${trimmedPath || '(picker)'}`);
      bridge.call('openBundleFile', trimmedPath ? { path: trimmedPath, title: 'Bundle File Preview' } : {}, (result: any) => {
        const ok = !!result?.ok;
        log(`[IDE] runBundleFileDirect bridge callback: ok=${ok} result=${JSON.stringify(result)}`);
        if (result?.canceled) {
          showOutput('info', 'Bundle file selection cancelled');
          setStatus('Bundle file selection cancelled');
          return;
        }
        const message = ok
          ? `Bundle file launched: ${result?.path || trimmedPath}`
          : `Bundle file run failed: ${result?.error || 'Unknown error'}`;
        showOutput(ok ? 'info' : 'error', message);
        setStatus(message);
      });
    } catch (e: any) {
      showOutput('error', `Bundle file run failed: ${e.message}`);
      setStatus(`Bundle file run failed: ${e.message}`);
    }
  }, [log, setStatus, showOutput]);

  const startBundleFileRun = useCallback(() => {
    setPickerQuery('');
    setPickerOpen(false);
    setPickerMode(undefined);
    void runBundleFileDirect();
  }, [runBundleFileDirect]);

  const openExampleArtifactWorkspace = useCallback((cachePath: string, metadata: ExampleArtifactMetadata) => {
    const workspace = buildExampleArtifactWorkspaceView(cachePath, metadata);
    const runContext = buildExampleArtifactRunContext(cachePath, metadata);
    const session = createExampleArtifactWorkspaceSession(
      runContext
        ? { ...runContext, activeFile: workspace.defaultFilePath || undefined }
        : {
            cachePath,
            activeFile: workspace.defaultFilePath || undefined,
            templateFile: '',
            title: `${metadata.name} — Preview`,
          },
    );
    applyWorkspaceSession(session);
    setDirContents(workspace.dirContents as Map<string, TreeNode[]>);
    setExpandedDirs(workspace.expandedDirs);
    setStatus(metadata.name);
    if (!runContext) {
      showOutput('warn', 'Example artifact does not include a run template');
    }
    return workspace.defaultFilePath;
  }, [applyWorkspaceSession, showOutput]);

  const fetchExampleArtifactByPath = useCallback(async (
    relativePath: string,
    navigation?: DeepLinkFileNavigation,
  ): Promise<string | null> => {
    const fetchThroughBridge = async (): Promise<ExampleArtifactFetchResult | null> => {
      const bridge = getDeepLinkBridge();
      if (!bridge?.call) return null;
      return await new Promise<ExampleArtifactFetchResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Example fetch timed out after ${EXAMPLE_FETCH_BRIDGE_TIMEOUT_MS}ms`));
        }, EXAMPLE_FETCH_BRIDGE_TIMEOUT_MS);
        try {
          bridge.call?.('fetchExampleArtifact', { relativePath }, (payload: ExampleArtifactFetchResult | null) => {
            clearTimeout(timeout);
            resolve(payload ?? {
              ok: false,
              error: {
                code: 'NETWORK_ERROR',
                message: 'Example fetch failed',
                detail: 'Bridge returned an empty payload',
              },
            });
          });
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    };

    const fetchDirect = async (): Promise<ExampleArtifactFetchResult | null> => {
      const api = exampleArtifactApi();
      if (!api?.fetch) return null;
      return await api.fetch(relativePath);
    };

    const fetchResult = async (): Promise<ExampleArtifactFetchResult | null> => {
      const bridged = await fetchThroughBridge();
      if (bridged) return bridged;
      return fetchDirect();
    };

    const apiAvailable = !!getDeepLinkBridge()?.call || !!exampleArtifactApi()?.fetch;
    if (!apiAvailable) {
      showOutput('error', 'Example Artifact API not available');
      setStatus('Example Artifact API unavailable');
      clearExampleArtifactLoading(true);
      return null;
    }
    showOutput('info', `Fetching example artifact: ${relativePath}`);
    setStatus(`Fetching example: ${relativePath}`);
    try {
      const result = await fetchResult();
      if (!result) {
        showOutput('error', 'Example Artifact API not available');
        setStatus('Example Artifact API unavailable');
        return null;
      }
      if (!result?.ok) {
        const error = result?.error;
        showOutput('error', `[${error?.code || 'UNKNOWN'}] ${error?.message || 'Example fetch failed'}`);
        if (error?.detail) {
          showOutput('warn', error.detail);
        }
        setStatus(error?.message || 'Example fetch failed');
        return null;
      }
      showOutput('info', `Example metadata loaded: ${result.metadata.name}`);
      showOutput('info', `Metadata URL: ${result.metadataUrl}`);
      showOutput('info', `Cache path: ${result.cachePath}`);
      showOutput('info', `Downloaded files: ${result.downloadedFiles.length}`);
      const defaultFilePath = openExampleArtifactWorkspace(result.cachePath, result.metadata);
      if (navigation) {
        openWorkspaceFileFromDeepLink(result.cachePath, navigation, `deep-link example ${relativePath}`);
      } else if (defaultFilePath) {
        showOutput('info', `Opening default file: ${defaultFilePath.replace(`${result.cachePath}/`, '')}`);
        openFile(defaultFilePath);
      } else {
        showOutput('warn', 'Example metadata did not include a default file');
      }
      setStatus(`Example loaded: ${result.exampleId}`);
      return result.cachePath;
    } catch (e: any) {
      showOutput('error', `Example fetch failed: ${e.message}`);
      setStatus('Example fetch failed');
      return null;
    } finally {
      clearExampleArtifactLoading();
    }
  }, [clearExampleArtifactLoading, openExampleArtifactWorkspace, openFile, openWorkspaceFileFromDeepLink, showOutput]);

  const openExampleArtifactDirect = useCallback((relativePath: string, navigation?: DeepLinkFileNavigation) => {
    setPickerOpen(false);
    setPickerMode(undefined);
    setPickerQuery('');
    const loading = buildExampleArtifactLoadingState(relativePath);
    startExampleArtifactLoading(loading);
    showOutput('info', loading.message);
    setStatus(loading.message);
    void fetchExampleArtifactByPath(relativePath, navigation);
  }, [fetchExampleArtifactByPath, showOutput, startExampleArtifactLoading]);

  const runBundleUrlDirect = useCallback((bundleUrl: string, options?: { title?: string }) => {
    const trimmedUrl = bundleUrl.trim();
    setPickerOpen(false);
    setPickerMode(undefined);
    setPickerQuery('');
    if (!trimmedUrl) {
      setStatus('No bundle URL provided');
      showOutput('error', 'No bundle URL provided');
      return;
    }
    const bridge = getDeepLinkBridge();
    if (!bridge?.call) {
      setStatus('Bundle runner bridge unavailable');
      showOutput('error', 'Bundle runner bridge unavailable');
      return;
    }
    showOutput('info', `Running bundle URL: ${trimmedUrl}`);
    setStatus(`Running bundle URL: ${trimmedUrl}`);
    try {
      log(`[IDE] runBundleUrlDirect bridge call: ${trimmedUrl}`);
      bridge.call('openBundleUrl', { url: trimmedUrl, title: options?.title || 'Bundle URL Preview' }, (result: any) => {
        const ok = !!result?.ok;
        log(`[IDE] runBundleUrlDirect bridge callback: ok=${ok} result=${JSON.stringify(result)}`);
        const message = ok
          ? `Bundle URL launched: ${trimmedUrl}`
          : `Bundle URL run failed: ${result?.error || 'Unknown error'}`;
        showOutput(ok ? 'info' : 'error', message);
        setStatus(message);
      });
    } catch (e: any) {
      showOutput('error', `Bundle URL run failed: ${e.message}`);
      setStatus(`Bundle URL run failed: ${e.message}`);
    }
  }, [showOutput]);

  useEffect(() => {
    try {
      const debugBundleUrl = getExposed()?.config?.get('debugBundleUrl');
      if (typeof debugBundleUrl === 'string' && debugBundleUrl.trim()) {
        const url = debugBundleUrl.trim();
        log(`[IDE] auto debug bundle url: ${url}`);
        getExposed()?.config?.set('debugBundleUrl', '');
        setTimeout(() => runBundleUrlDirect(url), 0);
      }
    } catch (_) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchShowcaseByUrl = useCallback(async (
    url: string,
    source: 'folder' | 'showcase' = 'folder',
    options?: { showLoading?: boolean },
  ): Promise<string | null> => {
    const shouldShowLoading = options?.showLoading !== false;
    if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('file://')) {
      showOutput('error', `Invalid URL: ${url}`);
      setStatus('Invalid URL');
      return null;
    }
    if (shouldShowLoading) {
      startShowcaseLoading('Preparing showcase workspace...');
    }
    showOutput('info', `Fetching showcase: ${url}`);
    setStatus('Fetching showcase...');
    try {
      const api = showcaseApi();
      const fetchFn = api?.fetch;
      console.log('[IDE] fetchShowcaseByUrl request', {
        url,
        hasApi: !!api,
        fetchType: typeof fetchFn,
      });
      log(
        `[IDE] fetchShowcaseByUrl request url=${url} hasApi=${!!api} fetchType=${typeof fetchFn}`,
      );
      const showcasePath = typeof fetchFn === 'function' ? await fetchFn(url) : null;
      if (showcasePath) {
        console.log('[IDE] fetchShowcaseByUrl success', { url, showcasePath });
        log(`[IDE] fetchShowcaseByUrl success url=${url} path=${showcasePath}`);
        showOutput('info', `Showcase fetched to: ${showcasePath}`);
        openFolder(showcasePath, source);
        setStatus(`Opened showcase: ${showcasePath.split('/').pop()}`);
        return showcasePath;
      }
      console.log('[IDE] fetchShowcaseByUrl empty result', { url });
      log(`[IDE] fetchShowcaseByUrl empty result url=${url}`);
      showOutput('error', `Fetch failed: empty result for ${url}`);
      setStatus('Fetch failed: empty result');
    } catch (e: any) {
      const message = e?.message || String(e);
      console.log('[IDE] fetchShowcaseByUrl error', { url, message, stack: e?.stack });
      log(`[IDE] fetchShowcaseByUrl error url=${url} message=${message}`);
      if (e?.stack) {
        log(`[IDE] fetchShowcaseByUrl stack ${String(e.stack).replace(/\n/g, ' | ')}`);
      }
      showOutput('error', `Fetch failed: ${message}`);
      setStatus(`Fetch failed: ${message}`);
    } finally {
      if (shouldShowLoading) {
        clearShowcaseLoading();
      }
    }
    return null;
  }, [clearShowcaseLoading, log, openFolder, showOutput, startShowcaseLoading]);

  const resolveShowcaseEntryWorkspacePath = useCallback(async (entry: ShowcaseEntry): Promise<string | null> => {
    log(`[resolveShowcaseEntryWorkspacePath] Starting, entry: ${entry.name}, SHOWCASE_LOCAL_WORKSPACE: ${SHOWCASE_LOCAL_WORKSPACE}, entry.path: ${entry.path}`);
    const localPath = SHOWCASE_LOCAL_WORKSPACE && entry.path
      ? showcaseApi()?.resolveRegistryPath?.(entry.path)
      : null;
    log(`[resolveShowcaseEntryWorkspacePath] localPath: ${localPath}`);
    if (localPath) {
      log(`[resolveShowcaseEntryWorkspacePath] Using local path, calling openFolder...`);
      openFolder(localPath, 'showcase');
      return localPath;
    }
    if (!entry.url) {
      showOutput('error', `No URL available for ${entry.name}`);
      return null;
    }
    log(`[resolveShowcaseEntryWorkspacePath] Calling fetchShowcaseByUrl for: ${entry.url}`);
    return await fetchShowcaseByUrl(entry.url, 'showcase', { showLoading: false });
  }, [fetchShowcaseByUrl, openFolder, showOutput, log]);

  // A workspace opened without explicit file navigation (the Gallery "IDE"
  // action's deep link carries only a showcase id + target=ide) still needs a
  // file in the editor — otherwise EditorPanel sits on its "Open Folder" empty
  // state even though the Explorer tree is populated. Pick a sensible entry file
  // (real source over config) and open it into a tab.
  const autoOpenDefaultFile = useCallback((workspacePath: string) => {
    const exposed = getExposed();
    if (!exposed) return;
    let topLevelFiles: string[] = [];
    try {
      const entries: Array<{ name: string; isDirectory: boolean }> = exposed.fs.readdirStat(workspacePath);
      topLevelFiles = entries.filter(e => !e.isDirectory && !HIDDEN.has(e.name)).map(e => e.name);
    } catch (e) {
      log(`[IDE] autoOpenDefaultFile readdir error: ${e}`);
      return;
    }
    // fs.exists, not readFile-in-try: bridge readFile reports failure as
    // null instead of throwing, so the old catch-probe always said true.
    const exists = (rel: string): boolean => !!exposed.fs.exists?.(`${workspacePath}/${rel}`);
    const rel = pickDefaultFile({ topLevelFiles, exists });
    if (rel) {
      log(`[IDE] autoOpenDefaultFile: ${rel}`);
      openFile(`${workspacePath}/${rel}`);
    }
  }, [log, openFile]);

  const openShowcaseEntry = useCallback(async (entry: ShowcaseEntry, navigation?: DeepLinkFileNavigation) => {
    const localPath = SHOWCASE_LOCAL_WORKSPACE && entry.path
      ? showcaseApi()?.resolveRegistryPath?.(entry.path)
      : null;
    if (localPath) {
      showOutput('info', `Opening local showcase workspace: ${entry.name}`);
    }
    startShowcaseLoading(`Preparing workspace for ${entry.name}...`);
    setStatus(`Opening showcase: ${entry.name}`);
    try {
      const workspacePath = await resolveShowcaseEntryWorkspacePath(entry);
      if (workspacePath) {
        if (navigation) {
          openWorkspaceFileFromDeepLink(workspacePath, navigation, `deep-link showcase ${entry.name}`);
        } else {
          autoOpenDefaultFile(workspacePath);
        }
      }
    } finally {
      clearShowcaseLoading();
    }
  }, [autoOpenDefaultFile, clearShowcaseLoading, openWorkspaceFileFromDeepLink, resolveShowcaseEntryWorkspacePath, showOutput, startShowcaseLoading]);

  // New chain (default): close the gallery and hand the showcase to the
  // Fiddle, which downloads/resolves the workspace and loads the source into
  // its editor mosaic.
  const openShowcaseInFiddle = useCallback((entry: ShowcaseEntry) => {
    setGalleryOpen(false);
    setLegacyIdeOpen(false);
    setPendingShowcaseTemplate(entry);
  }, []);

  // Legacy chain: the old IDE workspace route mounted IN this window —
  // still used by Open Folder / Resume / route chevrons.
  const openShowcaseInLegacyIde = useCallback((entry: ShowcaseEntry) => {
    setGalleryOpen(false);
    setLegacyIdeOpen(true);
    void openShowcaseEntry(entry);
  }, [openShowcaseEntry]);

  // Gallery "IDE" action: open the workspace in a NEW WINDOW. New window =
  // new PROCESS on purpose: the Scintilla registry, its keyWindow-based
  // attach, and the config-store writer lease all assume one window per
  // process. The child is this same app spawned with a target=ide deep link
  // in argv (consumed by the existing startup deep-link pipeline).
  const openShowcaseInIdeWindow = useCallback((entry: ShowcaseEntry) => {
    const rt = (foundationApi() as any)?.runtime;
    const exec = (foundationApi() as any)?.exec;
    if (!rt?.execPath || !rt?.appDir || !exec?.runAsync) {
      showOutput('warn', '[IDE] spawn bridge unavailable — opening in this window instead');
      openShowcaseInLegacyIde(entry);
      return;
    }
    const url = buildShowcaseIdeDeepLink(entry.name);
    const handle = exec.runAsync(rt.execPath, [rt.appDir, url], {
      env: {
        LYNXTRON_ALLOW_MULTI: '1',
        LYNXTRON_WINDOW_CASCADE: '1',
        LYNXTRON_BOOT_TARGET: 'ide',
        // Children must NOT inherit the dev automation channels — two pollers
        // on the same /tmp command files steal each other's commands.
        LYNXTRON_FIDDLE_DEV: '0',
      },
      onExit: (code: number | null) => {
        showOutput('info', `[IDE] window for "${entry.name}" exited (code=${code})`);
      },
    });
    if (handle?.pid) {
      setGalleryOpen(false);
      showOutput('info', `[IDE] opened "${entry.name}" in a new window (pid=${handle.pid})`);
      setStatus(`Opened ${entry.name} in new IDE window`);
    } else {
      showOutput('warn', '[IDE] spawn failed — opening in this window instead');
      openShowcaseInLegacyIde(entry);
    }
  }, [openShowcaseInLegacyIde, showOutput]);

  // Dev-only: app-level command file for page navigation. The Fiddle-level
  // poller (DEV_PRESET.commandFile) dies with the Fiddle when the gallery or
  // legacy IDE is showing, so navigation commands are drained here instead.
  useEffect(() => {
    const cmdFile = DEV_PRESET?.appCommandFile;
    if (!cmdFile || !isDevMode()) return;
    const t = setInterval(() => {
      for (const cmd of drainCommandFile(cmdFile)) {
        const { name, data, raw: trimmed } = cmd;
        const entry = data?.name ? SHOWCASE_REGISTRY.find(e => e.name === data.name) : undefined;
        appendOutput('info', `[DevCmd:app] ${trimmed}`);
        try {
        if (name === 'app:openGallery') setGalleryOpen(true);
        else if (name === 'app:galleryBack') setGalleryOpen(false);
        else if (name === 'app:openShowcase' && entry) openShowcaseInFiddle(entry);
        else if (name === 'app:openShowcaseLegacy' && entry) openShowcaseInIdeWindow(entry);
        else if (name === 'app:routeBack') handleRouteBack();
        else if (name === 'app:routeForward') handleRouteForward();
        else if (name === 'app:quickOpen') { setPickerQuery(''); setPickerMode(undefined); setPickerOpen(true); }
        else if (name === 'app:runShowcase' && entry) void runShowcaseEntry(entry);
        else if (name === 'app:runShowcaseWeb' && entry) void runShowcaseEntryOnWeb(entry);
        else if (name === 'app:quickClose') { setPickerOpen(false); setPickerMode(undefined); }
        else appendOutput('warn', `[DevCmd:app] unknown: ${trimmed}`);
        } catch (e: any) {
          appendOutput('error', `[DevCmd:app] ${name} failed: ${e?.message ?? String(e)}`);
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, [handleRouteBack, handleRouteForward, openShowcaseInFiddle, openShowcaseInIdeWindow]);

  const readDeepLinkRuntimeReadiness = useCallback(() => {
    let showcaseReady = false;
    try {
      showcaseReady = !!showcaseApi()?.fetch;
    } catch (_) {}

    let exampleReady = false;
    try {
      exampleReady = !!getDeepLinkBridge()?.call || !!exampleArtifactApi()?.fetch;
    } catch (_) {}

    return { showcaseReady, exampleReady };
  }, []);

  const applyResolvedDeepLinkAction = useCallback((action: DeepLinkDispatchAction, source: string): boolean => {
    const readiness = checkDeepLinkActionReadiness(action, readDeepLinkRuntimeReadiness());
    if (!readiness.ready) {
      log(`[IDE] deep link apply deferred: ${readiness.reason || 'runtime not ready'} [${source}]`);
      return false;
    }

    if (action.kind === 'error') {
      const message = `${action.message} [${source}]`;
      showOutput('error', message);
      setStatus('Deep link failed');
      return true;
    }

    if (action.kind === 'home') {
      detachNativeEditorView();
      workspaceSessionRef.current = null;
      setWorkspaceSession(null);
      setRouteNavigation(prev => enterHomeRoute(prev));
      setStatus('Opened Home from deep link');
      showOutput('info', `Deep link opened Home [${source}]`);
      return true;
    }

    if (action.kind === 'open-showcase') {
      log(`[IDE] deep link applying showcase action: ${action.entry.name} [${source}]`);
      showOutput('info', `Deep link opening showcase: ${action.entry.name} [${source}]`);
      if (action.navigation || action.target === 'ide') {
        // file:line navigation and target=ide are old-IDE capabilities —
        // mount it visibly (target=ide is how a spawned Gallery-IDE window
        // boots straight into the workspace).
        setGalleryOpen(false);
        setLegacyIdeOpen(true);
        void openShowcaseEntry(action.entry, action.navigation);
      } else {
        openShowcaseInFiddle(action.entry);
      }
      return true;
    }

    if (action.kind === 'open-bundle-url') {
      log(`[IDE] deep link applying bundle URL action: ${action.url} [${source}]`);
      showOutput('info', `Deep link opening bundle URL: ${action.url} [${source}]`);
      runBundleUrlDirect(action.url, { title: action.title });
      return true;
    }

    log(`[IDE] deep link applying example action: ${action.examplePath} [${source}]`);
    showOutput('info', `Deep link opening example: ${action.examplePath} [${source}]`);
    openExampleArtifactDirect(action.examplePath, action.navigation);
    return true;
  }, [detachNativeEditorView, log, openExampleArtifactDirect, openShowcaseEntry, openShowcaseInFiddle, readDeepLinkRuntimeReadiness, showOutput, runBundleUrlDirect]);

  const drainPendingDeepLinkAction = useCallback(() => {
    clearDeepLinkApplyRetry();
    const pending = pendingDeepLinkActionRef.current;
    if (!pending) return;

    const applied = applyResolvedDeepLinkAction(pending.action, pending.source);
    if (applied) {
      pendingDeepLinkActionRef.current = null;
      return;
    }

    deepLinkApplyRetryTimeoutRef.current = setTimeout(drainPendingDeepLinkAction, DEEP_LINK_APPLY_RETRY_DELAY_MS);
  }, [applyResolvedDeepLinkAction, clearDeepLinkApplyRetry]);

  const queueHostDeepLinkPayload = useCallback((payload: HostDeepLinkPayload | null, source: string) => {
    const action = resolveDeepLinkDispatchAction(payload, SHOWCASE_REGISTRY);
    if (!action) {
      log(`[IDE] deep link payload empty [${source}]`);
      return;
    }

    pendingDeepLinkActionRef.current = { action, source };
    log(`[IDE] deep link payload queued: ${action.kind} [${source}]`);
    drainPendingDeepLinkAction();
  }, [drainPendingDeepLinkAction, log]);

  const consumePendingDeepLink = useCallback((
    reason: 'startup' | 'event',
    options?: { suppressUnavailableError?: boolean },
  ): boolean => {
    const suppressUnavailableError = options?.suppressUnavailableError === true;
    const bridge = getDeepLinkBridge();
    if (!bridge?.call) {
      if (!suppressUnavailableError) {
        showOutput('error', 'Deep link bridge unavailable');
        setStatus('Deep link unavailable');
      }
      return false;
    }
    try {
      bridge.call('consumePendingDeepLink', {}, (payload: HostDeepLinkPayload | null) => {
        queueHostDeepLinkPayload(payload, reason);
      });
      return true;
    } catch (e: any) {
      showOutput('error', `Failed to consume deep link: ${e?.message || String(e)}`);
      setStatus('Deep link failed');
      return false;
    }
  }, [queueHostDeepLinkPayload, showOutput]);

  const stopGalleryRun = useCallback(() => {
    if (runningPid == null) return;
    const ok = showcaseApi()?.stop?.(runningPid) ?? false;
    appendProcessLine('command', ok ? `Stopped (pid ${runningPid})` : `Stop failed (pid ${runningPid})`);
    if (ok) setRunningPid(null);
  }, [runningPid]);

  const runShowcaseEntry = useCallback(async (entry: ShowcaseEntry) => {
    console.log('[runShowcaseEntry] Starting, entry:', entry);
    log(`[runShowcaseEntry] Starting, entry: ${JSON.stringify(entry)}`);
    const api = showcaseApi();
    console.log('[runShowcaseEntry] showcaseApi:', api);
    (()=>{
      "background only"
      if (NativeModules.nodejs) {
        log("[runShowcaseEntry] NativeModules?.nodejs");
        if (NativeModules.nodejs.exposed) {
          log("[runShowcaseEntry] NativeModules?.nodejs?.exposed" + JSON.stringify(NativeModules.nodejs.exposed));
        } else {
          log("[runShowcaseEntry] NativeModules?.nodejs?.exposed not available");
        }
      } else {
        log("[runShowcaseEntry] NativeModules?.nodejs not available");
      }
    })();
    log(`[runShowcaseEntry] showcaseApi: ${api ? 'available' : 'null'}`);
    if (!api) {
      showOutput('error', 'Showcase runtime unavailable');
      return;
    }
    startShowcaseLoading(`Preparing workspace for ${entry.name}...`);
    appendProcessLine('command', `Run showcase: ${entry.name}`);
    try {
      log(`[runShowcaseEntry] Calling resolveShowcaseEntryWorkspacePath...`);
      const showcasePath = await resolveShowcaseEntryWorkspacePath(entry);
      console.log('[runShowcaseEntry] showcasePath:', showcasePath);
      log(`[runShowcaseEntry] showcasePath resolved: ${showcasePath}`);
      setStatus(`[runShowcaseEntry] showcasePath resolved: ${showcasePath}`);
      if (!showcasePath) return;
      
      log(`[runShowcaseEntry] Checking if built: ${showcasePath}`);
      const isBuilt = api.isBuilt(showcasePath);
      console.log('[runShowcaseEntry] isBuilt:', isBuilt);
      log(`[runShowcaseEntry] isBuilt: ${isBuilt}`);
      if (!isBuilt) {
        showOutput('error', 'Showcase not built — dist/desktop/main.js not found');
        appendProcessLine('stderr', 'Not built — dist/desktop/main.js not found. Open it in the Fiddle and Run to build from source.');
        setStatus('Not built');
        return;
      }
      
      showOutput('info', `Launching showcase: ${showcasePath}`);
      setStatus('Launching showcase...');
      log(`[runShowcaseEntry] Calling api.run...`);
      const pid = api.run(showcasePath);
      console.log('[runShowcaseEntry] api.run returned pid:', pid);
      log(`[runShowcaseEntry] api.run returned pid: ${pid}`);
      setRunningPid(pid);
      showOutput('info', `Showcase launched (pid ${pid})`);
      appendProcessLine('command', `Launched (pid ${pid})`);
      setStatus(`Running (pid ${pid})`);
    } catch (e: any) {
      console.error('[runShowcaseEntry] Error:', e);
      log(`[runShowcaseEntry] Error: ${e.message}, stack: ${e.stack}`);
      showOutput('error', `Run failed: ${e.message}`);
      appendProcessLine('stderr', `Run failed: ${e.message}`);
      setStatus('Run failed');
    } finally {
      clearShowcaseLoading();
    }
  }, [clearShowcaseLoading, resolveShowcaseEntryWorkspacePath, showOutput, startShowcaseLoading, log]);

  const hasShowcaseWebTarget = useCallback((showcasePath: string): boolean => {
    try {
      return !!showcaseApi()?.getTargets?.(showcasePath)?.includes('web');
    } catch {
      return false;
    }
  }, []);

  const runShowcasePathOnWeb = useCallback(async (showcasePath: string) => {
    const api = showcaseApi();
    if (!api) {
      showOutput('error', 'Showcase runtime unavailable');
      setStatus('Showcase runtime unavailable');
      return;
    }
    if (!hasShowcaseWebTarget(showcasePath)) {
      showOutput('error', 'This showcase does not support Web');
      appendProcessLine('stderr', 'This showcase does not support Web');
      setStatus('Web target unavailable');
      return;
    }

    appendProcessLine('command', `Run on Web: ${showcasePath}`);
    const shouldRunFromSource =
      !api.isWebBuilt?.(showcasePath) || !!api.needsWebSourceRun?.(showcasePath);
    try {
      if (shouldRunFromSource) {
        if (!api.startWeb) {
          showOutput('error', 'Showcase web run API not available');
          setStatus('Web run unavailable');
          return;
        }

        if (api.needsInstall?.(showcasePath)) {
          showOutput('info', `Installing dependencies: ${showcasePath}`);
          setStatus('Installing dependencies...');
        }

        if (!api.needsInstall?.(showcasePath)) {
          setStatus('Launching web run...');
        }
        showOutput('info', `Launching web run from source: ${showcasePath}`);
        const pid = await api.startWeb(showcasePath);
        setRunningPid(pid);
        showOutput('info', `Web run command started (pid ${pid})`);
        appendProcessLine('command', `Web run building from source (pid ${pid}) — browser opens when the server is ready`);
        setStatus(`Web run starting (pid ${pid})`);
        return;
      }

      if (!api.runWeb) {
        showOutput('error', 'Showcase built web API not available');
        setStatus('Web run unavailable');
        return;
      }

      showOutput('info', `Launching built web run: ${showcasePath}`);
      setStatus('Launching built web run...');
      const pid = api.runWeb(showcasePath);
      setRunningPid(pid);
      showOutput('info', `Built web run launched (pid ${pid})`);
      appendProcessLine('command', `Serving built web output (pid ${pid}) — browser opens when the server is ready`);
      setStatus(`Web run running (pid ${pid})`);
    } catch (e: any) {
      showOutput('error', `Web run failed: ${e.message}`);
      appendProcessLine('stderr', `Web run failed: ${e.message}`);
      setStatus('Web run failed');
    }
  }, [hasShowcaseWebTarget, showOutput]);

  const debugShowcasePathOnWeb = useCallback(async (showcasePath: string) => {
    const api = showcaseApi();
    if (!api) {
      showOutput('error', 'Showcase runtime unavailable');
      setStatus('Showcase runtime unavailable');
      return;
    }
    if (!hasShowcaseWebTarget(showcasePath)) {
      showOutput('error', 'This showcase does not support Web');
      setStatus('Web target unavailable');
      return;
    }
    if (!api.devWeb) {
      showOutput('error', 'Showcase web debug API not available');
      setStatus('Web debug unavailable');
      return;
    }

    if (api.needsInstall?.(showcasePath)) {
      showOutput('info', `Installing dependencies: ${showcasePath}`);
      setStatus('Installing dependencies...');
    }

    try {
      if (!api.needsInstall?.(showcasePath)) {
        setStatus('Launching web debug...');
      }
      showOutput('info', `Launching web debug: ${showcasePath}`);
      const pid = await api.devWeb(showcasePath);
      setRunningPid(pid);
      showOutput('info', `Web debug command started (pid ${pid})`);
      setStatus(`Web debug starting (pid ${pid})`);
    } catch (e: any) {
      showOutput('error', `Web debug failed: ${e.message}`);
      setStatus('Web debug failed');
    }
  }, [hasShowcaseWebTarget, showOutput]);

  const runShowcaseEntryOnWeb = useCallback((entry: ShowcaseEntry) => {
    startShowcaseLoading(`Preparing workspace for ${entry.name}...`);
    void (async () => {
      try {
        const showcasePath = await resolveShowcaseEntryWorkspacePath(entry);
        if (!showcasePath) return;
        await runShowcasePathOnWeb(showcasePath);
      } finally {
        clearShowcaseLoading();
      }
    })();
  }, [clearShowcaseLoading, resolveShowcaseEntryWorkspacePath, runShowcasePathOnWeb, startShowcaseLoading]);

  const handlePickerSelect = useCallback((value: string) => {
    if (pickerMode === 'url') {
      setPickerOpen(false);
      setPickerMode(undefined);
      void fetchShowcaseByUrl(value, 'showcase');
      return;
    }
    if (pickerMode === 'bundleUrl') {
      runBundleUrlDirect(value);
      return;
    }
    if (pickerMode === 'example') {
      openExampleArtifactDirect(value);
      return;
    }
    openFile(value);
    setPickerOpen(false);
  }, [pickerMode, openFile, fetchShowcaseByUrl, openExampleArtifactDirect, runBundleUrlDirect]);

  const handleSelectShowcase = useCallback((entry: ShowcaseEntry) => {
    setPickerOpen(false);
    setPickerMode(undefined);
    openShowcaseInFiddle(entry);
  }, [openShowcaseInFiddle]);

  const handleRunCurrentWorkspace = useCallback(async () => {
    const target = resolveWorkspaceRunTarget(workspaceSessionRef.current);
    if (target.kind === 'none') {
      showOutput('error', target.reason);
      setStatus(target.reason);
      return;
    }

    if (target.kind === 'showcase') {
      const api = showcaseApi();
      if (!api) {
        showOutput('error', 'Showcase API not available');
        setStatus('Showcase API unavailable');
        return;
      }

      const shouldRunFromSource =
        !api.isBuilt(target.rootPath) || !!api.needsSourceRun?.(target.rootPath);
      if (shouldRunFromSource) {
        if (!api.start) {
          showOutput('error', 'Showcase source run API not available');
          setStatus('Run unavailable');
          return;
        }

        if (api.needsInstall?.(target.rootPath)) {
          showOutput('info', `Installing dependencies: ${target.rootPath}`);
          setStatus('Installing dependencies...');
        }

        if (!api.needsInstall?.(target.rootPath)) {
          setStatus('Launching run...');
        }
        showOutput('info', `Launching run from source: ${target.rootPath}`);
        try {
          const pid = await api.start(target.rootPath);
          setRunningPid(pid);
          showOutput('info', `Run command started (pid ${pid})`);
          setStatus(`Run starting (pid ${pid})`);
        } catch (e: any) {
          showOutput('error', `Run failed: ${e.message}`);
          setStatus('Run failed');
        }
        return;
      }

      showOutput('info', `Launching run: ${target.rootPath}`);
      setStatus('Launching run...');
      try {
        const pid = api.run(target.rootPath);
        setRunningPid(pid);
        showOutput('info', `Run launched (pid ${pid})`);
        setStatus(`Run running (pid ${pid})`);
      } catch (e: any) {
        showOutput('error', `Run failed: ${e.message}`);
        setStatus('Run failed');
      }
      return;
    }

    const api = exampleArtifactApi();
    if (!api?.run) {
      showOutput('error', 'Example Artifact run API not available');
      setStatus('Example run API unavailable');
      return;
    }

    showOutput('info', `Running example artifact: ${target.templateFile}`);
    try {
      const pid = api.run(target.cachePath, target.templateFile, target.title);
      setRunningPid(pid);
      showOutput('info', `Example artifact launched (pid ${pid})`);
      setStatus(`Example running (pid ${pid})`);
    } catch (e: any) {
      showOutput('error', `Example run failed: ${e.message}`);
      setStatus('Example run failed');
    }
  }, [showOutput]);

  const handleRunCurrentWorkspaceOnWeb = useCallback(() => {
    const session = workspaceSessionRef.current;
    if (!session || session.kind !== 'showcase') {
      showOutput('error', 'Run on Web is only available for showcase workspaces');
      setStatus('Web run unavailable');
      return;
    }
    void runShowcasePathOnWeb(session.rootPath);
  }, [runShowcasePathOnWeb, showOutput]);

  const handleDebugCurrentShowcase = useCallback(async () => {
    const session = workspaceSessionRef.current;
    if (!session || session.kind !== 'showcase') {
      showOutput('error', 'Debug is only available for showcase workspaces');
      setStatus('Debug unavailable');
      return;
    }

    const api = showcaseApi();
    if (!api?.dev) {
      showOutput('error', 'Showcase debug API not available');
      setStatus('Showcase debug unavailable');
      return;
    }

    if (api.needsInstall?.(session.rootPath)) {
      showOutput('info', `Installing dependencies: ${session.rootPath}`);
      setStatus('Installing dependencies...');
    }

    try {
      if (!api.needsInstall?.(session.rootPath)) {
        setStatus('Launching showcase debug...');
      }
      showOutput('info', `Launching showcase debug: ${session.rootPath}`);
      const pid = await api.dev(session.rootPath);
      setRunningPid(pid);
      showOutput('info', `Showcase debug command started (pid ${pid})`);
      setStatus(`Debug starting (pid ${pid})`);
    } catch (e: any) {
      showOutput('error', `Debug failed: ${e.message}`);
      setStatus('Debug failed');
    }
  }, [showOutput]);

  const handleDebugCurrentShowcaseOnWeb = useCallback(() => {
    const session = workspaceSessionRef.current;
    if (!session || session.kind !== 'showcase') {
      showOutput('error', 'Debug on Web is only available for showcase workspaces');
      setStatus('Web debug unavailable');
      return;
    }
    void debugShowcasePathOnWeb(session.rootPath);
  }, [debugShowcasePathOnWeb, showOutput]);

  const handleInstallCurrentShowcaseDependencies = useCallback(async () => {
    const session = workspaceSessionRef.current;
    if (!session || session.kind !== 'showcase') {
      showOutput('error', 'Install Dependencies is only available for showcase workspaces');
      setStatus('Install unavailable');
      return;
    }

    const api = showcaseApi();
    if (!api?.installDependencies) {
      showOutput('error', 'Showcase install API not available');
      setStatus('Install unavailable');
      return;
    }

    showOutput('info', `Installing dependencies: ${session.rootPath}`);
    setStatus('Installing dependencies...');
    try {
      await api.installDependencies(session.rootPath);
      showOutput('info', `Dependencies installed: ${session.rootPath}`);
      setStatus('Dependencies installed');
    } catch (e: any) {
      showOutput('error', `Install failed: ${e.message}`);
      setStatus('Install failed');
    }
  }, [showOutput]);

  const handleStopShowcase = useCallback(() => {
    if (!runningPid) return;
    try {
      process.kill?.(runningPid);
    } catch (_) {}
    showOutput('info', `Stopped showcase (pid ${runningPid})`);
    setStatus('Stopped');
    setRunningPid(null);
  }, [runningPid, showOutput]);

  useEffect(() => {
    try {
      // @ts-ignore
      globalThis.__ide_debugOpenExampleArtifactRoute = (relativePath: string = 'view') => {
        log(`[IDE] __ide_debugOpenExampleArtifactRoute called: ${relativePath}`);
        openExampleArtifactDirect(relativePath);
      };
      // @ts-ignore
      globalThis.__ide_debugRunCurrentWorkspace = () => {
        log('[IDE] __ide_debugRunCurrentWorkspace called');
        handleRunCurrentWorkspace();
      };
      // @ts-ignore
      globalThis.__ide_debugDebugCurrentShowcase = () => {
        log('[IDE] __ide_debugDebugCurrentShowcase called');
        handleDebugCurrentShowcase();
      };
      // @ts-ignore
      globalThis.__ide_debugRunCurrentWorkspaceOnWeb = () => {
        log('[IDE] __ide_debugRunCurrentWorkspaceOnWeb called');
        handleRunCurrentWorkspaceOnWeb();
      };
      // @ts-ignore
      globalThis.__ide_debugDebugCurrentShowcaseOnWeb = () => {
        log('[IDE] __ide_debugDebugCurrentShowcaseOnWeb called');
        handleDebugCurrentShowcaseOnWeb();
      };
      // @ts-ignore
      globalThis.__ide_debugInstallCurrentShowcaseDependencies = () => {
        log('[IDE] __ide_debugInstallCurrentShowcaseDependencies called');
        handleInstallCurrentShowcaseDependencies();
      };
      // @ts-ignore
      globalThis.__ide_debugRunBundleUrl = (bundleUrl: string = '') => {
        log(`[IDE] __ide_debugRunBundleUrl called: ${bundleUrl}`);
        runBundleUrlDirect(bundleUrl);
      };
      // @ts-ignore
      globalThis.__ide_debugRunBundleFile = (bundlePath: string = '') => {
        log(`[IDE] __ide_debugRunBundleFile called: ${bundlePath}`);
        runBundleFileDirect(bundlePath);
      };
    } catch (_) { /* ignore */ }
    return () => {
      try {
        // @ts-ignore
        delete globalThis.__ide_debugOpenExampleArtifactRoute;
        // @ts-ignore
        delete globalThis.__ide_debugRunCurrentWorkspace;
        // @ts-ignore
        delete globalThis.__ide_debugDebugCurrentShowcase;
        // @ts-ignore
        delete globalThis.__ide_debugRunCurrentWorkspaceOnWeb;
        // @ts-ignore
        delete globalThis.__ide_debugDebugCurrentShowcaseOnWeb;
        // @ts-ignore
        delete globalThis.__ide_debugInstallCurrentShowcaseDependencies;
        // @ts-ignore
        delete globalThis.__ide_debugRunBundleUrl;
        // @ts-ignore
        delete globalThis.__ide_debugRunBundleFile;
      } catch (_) {}
    };
  }, [handleDebugCurrentShowcase, handleDebugCurrentShowcaseOnWeb, handleInstallCurrentShowcaseDependencies, handleRunCurrentWorkspace, handleRunCurrentWorkspaceOnWeb, log, openExampleArtifactDirect, runBundleUrlDirect, runBundleFileDirect]);

  // Register showcase commands after the run callback exists so Lynx TDZ checks stay happy.
  useEffect(() => {
    registerShowcaseCommands({
      openFolder,
      setPickerOpen,
      setPickerQuery,
      getWorkspaceSession: () => workspaceSessionRef.current,
      hasCurrentShowcaseWebTarget: () => {
        const mode = workspaceSessionRef.current;
        return !!mode && mode.kind === 'showcase' && hasShowcaseWebTarget(mode.rootPath);
      },
      runCurrentWorkspace: handleRunCurrentWorkspace,
      runCurrentWorkspaceOnWeb: handleRunCurrentWorkspaceOnWeb,
      debugCurrentShowcase: handleDebugCurrentShowcase,
      debugCurrentShowcaseOnWeb: handleDebugCurrentShowcaseOnWeb,
      installCurrentShowcaseDependencies: handleInstallCurrentShowcaseDependencies,
      openFolderDialog,
      startShowcaseList,
      startUrlFetch,
      startBundleUrlFetch,
      startBundleFileRun,
      startExampleFetch,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFolder, openFolderDialog, startShowcaseList, startUrlFetch, startBundleUrlFetch, startBundleFileRun, startExampleFetch, handleRunCurrentWorkspace, handleRunCurrentWorkspaceOnWeb, handleDebugCurrentShowcase, handleDebugCurrentShowcaseOnWeb, handleInstallCurrentShowcaseDependencies, hasShowcaseWebTarget]);

  useEffect(() => {
    let disposed = false;
    const pollUntilBridgeReady = () => {
      if (disposed) return;
      const ok = consumePendingDeepLink('startup', { suppressUnavailableError: true });
      if (ok) {
        clearDeepLinkStartupRetry();
        return;
      }
      deepLinkStartupRetryTimeoutRef.current = setTimeout(pollUntilBridgeReady, DEEP_LINK_STARTUP_RETRY_DELAY_MS);
    };
    pollUntilBridgeReady();
    return () => {
      disposed = true;
      clearDeepLinkStartupRetry();
      clearDeepLinkApplyRetry();
    };
  }, [clearDeepLinkApplyRetry, clearDeepLinkStartupRetry, consumePendingDeepLink]);

  useEffect(() => {
    try {
      // @ts-ignore
      const emitter = lynx.getJSModule('GlobalEventEmitter');
      const onPendingDeepLink = () => {
        log('[IDE] ide:deepLinkPending received');
        consumePendingDeepLink('event');
      };
      emitter.addListener('ide:deepLinkPending', onPendingDeepLink);
      return () => {
        try {
          emitter.removeListener('ide:deepLinkPending', onPendingDeepLink);
        } catch (_) {}
      };
    } catch (_) {}
  }, [consumePendingDeepLink, log]);

  // ── Run/Stop menu hotkeys (Cmd+R / Cmd+Shift+R) ─────────────────────────
  useEffect(() => {
    try {
      // @ts-ignore
      const emitter = lynx.getJSModule('GlobalEventEmitter');
      const onRun = () => { log('[IDE] ide:runShowcase received'); void handleRunCurrentWorkspace(); };
      const onRunWeb = () => { log('[IDE] ide:runShowcaseWeb received'); handleRunCurrentWorkspaceOnWeb(); };
      const onDev = () => { log('[IDE] ide:devShowcase received'); void handleDebugCurrentShowcase(); };
      const onDevWeb = () => { log('[IDE] ide:devShowcaseWeb received'); handleDebugCurrentShowcaseOnWeb(); };
      const onInstall = () => { log('[IDE] ide:installShowcaseDependencies received'); void handleInstallCurrentShowcaseDependencies(); };
      const onStop = () => { log('[IDE] ide:stopShowcase received'); handleStopShowcase(); };
      emitter.addListener('ide:runShowcase', onRun);
      emitter.addListener('ide:runShowcaseWeb', onRunWeb);
      emitter.addListener('ide:devShowcase', onDev);
      emitter.addListener('ide:devShowcaseWeb', onDevWeb);
      emitter.addListener('ide:installShowcaseDependencies', onInstall);
      emitter.addListener('ide:stopShowcase', onStop);
      return () => {
        try {
          emitter.removeListener('ide:runShowcase', onRun);
          emitter.removeListener('ide:runShowcaseWeb', onRunWeb);
          emitter.removeListener('ide:devShowcase', onDev);
          emitter.removeListener('ide:devShowcaseWeb', onDevWeb);
          emitter.removeListener('ide:installShowcaseDependencies', onInstall);
          emitter.removeListener('ide:stopShowcase', onStop);
        } catch (_) {}
      };
    } catch (_) {}
  }, [handleRunCurrentWorkspace, handleRunCurrentWorkspaceOnWeb, handleDebugCurrentShowcase, handleDebugCurrentShowcaseOnWeb, handleInstallCurrentShowcaseDependencies, handleStopShowcase, log]);

  useEffect(() => {
    return () => {
      if (exampleArtifactLoadingClearTimeoutRef.current) {
        clearTimeout(exampleArtifactLoadingClearTimeoutRef.current);
        exampleArtifactLoadingClearTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSelectSidebarPanel = useCallback((id: string) => {
    setSidebarPanel(id);
    saveLayout('layout.sidebarPanel', id);
  }, [saveLayout]);

  const handleCloseBottomPanel = useCallback(() => {
    setBottomPanelOpen(false);
    saveLayout('layout.bottomPanelOpen', false);
  }, [saveLayout]);

  // Fiddle is the main content and stays MOUNTED under the gallery, which
  // renders as a full-page overlay (unmounting the Fiddle kills its native
  // editor buffers; overlayActive detaches them instead — same machinery as
  // dialogs). Per-instance scoping falls out structurally: each Fiddle
  // instance owns its overlay, so gallery "Open" always targets the instance
  // it was opened from — never another (self-hosted) Fiddle. The per-card
  // "IDE" action keeps the legacy open-showcase-in-workspace route alive by
  // mounting the old IDE shell — the route back-chevron leaves it again.
  const showLegacyIde = legacyIdeOpen && route.kind === 'workspace';
  // One props object for both gallery hosts — the in-shell page and the
  // legacy full overlay must never drift apart callback-by-callback.
  const galleryProps = {
    onBack: () => setGalleryOpen(false),
    onOpenFolder: () => { setGalleryOpen(false); setLegacyIdeOpen(true); openFolderDialog(); },
    onOpenShowcase: openShowcaseInFiddle,
    onOpenShowcaseLegacy: openShowcaseInIdeWindow,
    onRunShowcase: runShowcaseEntry,
    onRunShowcaseOnWeb: runShowcaseEntryOnWeb,
    onDebugExampleRoute: () => { setGalleryOpen(false); setLegacyIdeOpen(true); openExampleArtifactDirect('view'); },
  };
  const galleryNode = isGalleryOpen ? <GalleryHome {...galleryProps} /> : null;
  // Legacy IDE has no Fiddle shell to host the gallery — full overlay fallback
  // (standalone: the page carries its own Back since there is no commands bar).
  const galleryOverlay = showLegacyIde && isGalleryOpen ? (
    <view className="GalleryOverlay">
      <GalleryHome {...galleryProps} standalone />
    </view>
  ) : null;
  const mainContent = showLegacyIde ? (
    <IDE
      rootPath={currentRootPath}
      tabs={tabs}
      activeTabId={activeTabId}
      sidebarPanel={sidebarPanel}
      sidebarRatio={sidebarRatio}
      editorBottomRatio={editorBottomRatio}
      bottomPanelOpen={bottomPanelOpen}
      bottomPanelTab={bottomPanelTab}
      dirContents={dirContents}
      expandedDirs={expandedDirs}
      onSelectSidebarPanel={handleSelectSidebarPanel}
      onSidebarRatioChange={(r) => { setSidebarRatio(r); debouncedSaveRatio('layout.sidebarRatio', r); }}
      onEditorBottomRatioChange={(r) => { setEditorBottomRatio(r); debouncedSaveRatio('layout.editorBottomRatio', r); }}
      onCloseBottomPanel={handleCloseBottomPanel}
      onToggleDir={toggleDir}
      onOpenFile={openFile}
      onOpenFileAt={openFileAt}
      onEditorLayout={repushActiveEditor}
      onOpenFolderDialog={openFolderDialog}
      onSwitchTab={switchTab}
      onCloseTab={closeTab}
    />
  ) : (
    <Fiddle
      rootPath={currentRootPath}
      onOpenGallery={() => setGalleryOpen(true)}
      onRunShowcase={(entry) => { void runShowcaseEntry(entry); }}
      pendingShowcaseTemplate={pendingShowcaseTemplate}
      onShowcaseTemplateConsumed={() => setPendingShowcaseTemplate(null)}
      // Quick Open (Cmd+P) is an App-level overlay just like the gallery —
      // native editors float above every Lynx layer, so the Fiddle must
      // detach them while the palette is up or it renders half-hidden.
      overlayActive={isGalleryOpen || pickerOpen}
      galleryOpen={isGalleryOpen}
      gallery={galleryNode}
      onCloseGallery={() => setGalleryOpen(false)}
      externalRunPid={runningPid}
      onStopExternalRun={stopGalleryRun}
      onThemeChange={() => setUiThemeDark(isDarkTheme())}
    />
  );
  const activeLoading = showcaseLoading ?? exampleArtifactLoading;
  const canGoBack = canNavigateRouteBack(routeNavigation);
  const canGoForward = canNavigateRouteForward(routeNavigation);
  // A window spawned as a dedicated IDE (Gallery IDE action) has no Fiddle to
  // navigate back to — route chevrons are meaningless chrome there.
  const isIdeBootWindow = (() => {
    try { return (getExposed() as any)?.bootTarget === 'ide'; } catch (_) { return false; }
  })();

  return (
    <view className={'IDE' + (uiThemeDark ? '' : ' theme-light')}>
      <view className="IDEStage">
        {/* Route chevrons belong to the legacy IDE only — the Fiddle is the
            home page and must carry no route chrome (a floating disabled
            back-arrow over the Fiddle read as a mystery control). */}
        {showLegacyIde && !isIdeBootWindow && (canGoBack || canGoForward) ? (
          <RouteNavigationControls
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={handleRouteBack}
            onForward={handleRouteForward}
          />
        ) : null}
        {mainContent}
        {galleryOverlay}
        <LoadingOverlay visible={!!activeLoading} message={activeLoading?.message} />
      </view>

      {pickerOpen && (
        <QuickPicker
          rootPath={currentRootPath}
          query={pickerQuery}
          filteredFiles={filteredFiles}
          mode={pickerMode}
          onQueryChange={(q) => {
            setPickerQuery(q);
            // If user types > while in showcases/url mode, switch back to commands
            if (q.startsWith('>') && pickerMode !== 'commands') setPickerMode(undefined);
          }}
          onSelect={handlePickerSelect}
          onSelectShowcase={handleSelectShowcase}
          onClose={() => { setPickerOpen(false); setPickerMode(undefined); }}
        />
      )}

    </view>
  );
}
