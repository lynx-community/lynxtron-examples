import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { SplitContainer } from '../components/Layout/SplitContainer';
import { Header } from './Header/Header';
import { FiddleSidebar } from './Sidebar/FiddleSidebar';
import { Editors } from './Editors/Editors';
import { Outputs } from './Outputs/Outputs';
import { TemplatePicker } from './Templates/TemplatePicker';
import { Settings } from './settings/Settings';
import { VersionChooser } from './versions/VersionChooser';
import { WelcomeTour } from './tour/WelcomeTour';
import { HistoryDialog } from './history/HistoryDialog';
import { CurrentFileFindBar } from '../components/FindBar/CurrentFileFindBar';
import './history/HistoryDialog.css';
import { ToasterHost, AppToaster } from './bp';
import { useFiddle } from './state/useFiddle';
import { materializeFiddle } from './runner/materialize';
import { pickSaveFolder, writeFiddleToFolder } from './runner/save';
import { useRunner } from './runner/useRunner';
import { spawnRuntimeForWorkspace } from './runner/spawnRuntime';
import { loadGistFiddle, parseGistId, publishGistFiddle } from './gist/gist-loader';
import { loadLocalFiddle } from './runner/open';
import { resolveShowcaseWorkspace, loadShowcaseFiddle, writeFiddleToWorkspace } from './runner/showcase-open';
import { showcaseApi, appendFiddleOutput as appendOutput, type ShowcaseEntry, foundationApi } from '../store';
import { DEV_PRESET, isDevMode, drainCommandFile } from './dev-preset';
import { applyEditorThemeAll, setThemeSetting } from './theme';
import {
  findCurrentFileMatches,
  getWrappedMatchIndex,
  type CurrentFileMatch,
} from '../shared/current-file-search';
import './Fiddle.css';
import './settings/Settings.css';
import './versions/VersionChooser.css';
import './tour/WelcomeTour.css';

export interface FiddleProps {
  rootPath: string | null;
  onOpenGallery: () => void;
  onCloseGallery?: () => void;
  onRunShowcase?: (entry: ShowcaseEntry) => void;
  lynxtronVersion?: string;
  /** Showcase handed over by the gallery's Open — consumed once on mount/change. */
  pendingShowcaseTemplate?: ShowcaseEntry | null;
  onShowcaseTemplateConsumed?: () => void;
  /** A full-page overlay (gallery) covers the Fiddle — detach native editors. */
  overlayActive?: boolean;
  /** Gallery page rendered INSIDE the shell (covers the sidebar+editors
      region only — the commands bar and console stay live around it). */
  galleryOpen?: boolean;
  gallery?: any;
  /** A run launched from the gallery — surfaced in the shared console. */
  externalRunPid?: number | null;
  onStopExternalRun?: () => void;
  /** Theme setting changed — App re-reads config and swaps the UI class. */
  onThemeChange?: () => void;
}

interface FiddleFindState {
  visible: boolean;
  query: string;
  matches: CurrentFileMatch[];
  activeMatchIndex: number;
  editorId: string | null;
}

export function Fiddle(props: FiddleProps) {
  const fiddle = useFiddle();
  const runner = useRunner();
  const [isConsoleShowing, setConsoleShowing] = useState(true);
  const devBoot = isDevMode() ? DEV_PRESET : null;
  const [templatePickerOpen, setTemplatePickerOpen] = useState(devBoot?.openSurface === 'templates');
  const [settingsOpen, setSettingsOpen] = useState(devBoot?.openSurface === 'settings');
  const [versionsOpen, setVersionsOpen] = useState(devBoot?.openSurface === 'versions');
  const [tourOpen, setTourOpen] = useState(devBoot?.openSurface === 'tour');
  const [historyOpen, setHistoryOpen] = useState(devBoot?.openSurface === 'history');
  const [currentShowcase, setCurrentShowcase] = useState<ShowcaseEntry | null>(null);
  const [findState, setFindState] = useState<FiddleFindState>({
    visible: false,
    query: '',
    matches: [],
    activeMatchIndex: -1,
    editorId: null,
  });
  const [findFocusKey, setFindFocusKey] = useState(0);
  // Real runtime version from the foundation bridge (engine report or the
  // bundled package manifest); prop override kept for tests/self-host.
  const currentVersion = props.lynxtronVersion
    || (() => {
      const v = foundationApi()?.runtime?.version;
      return v ? `Lynxtron ${v}` : 'Lynxtron';
    })();
  const [selectedLocalName, setSelectedLocalName] = useState<string | null>(() =>
    (foundationApi()?.config?.get?.('fiddle.selectedLocalVersion') as string | null) ?? null,
  );

  const handleSelectLocalVersion = useCallback((name: string | null) => {
    setSelectedLocalName(name);
    foundationApi()?.config?.set?.('fiddle.selectedLocalVersion', name);
    appendOutput('info', `[Fiddle] Selected runtime: ${name ?? 'bundled ' + currentVersion}`);
  }, [currentVersion]);

  const resolveLocalVersionFolder = useCallback((): string | null => {
    if (!selectedLocalName) return null;
    const localVersions = (foundationApi()?.config?.get?.('fiddle.localVersions') as any[]) ?? [];
    const match = localVersions.find((v: any) => v.name === selectedLocalName);
    return match?.folder ?? null;
  }, [selectedLocalName]);

  useEffect(() => {
    if (DEV_PRESET?.suppressTour && isDevMode()) return;
    const cfg = foundationApi()?.config;
    const settings = cfg?.get?.('fiddle.settings') as any;
    const seen = cfg?.get?.('fiddle.tour.seen');
    const showTour = settings?.showWelcomeTour !== false;
    if (!seen && showTour) setTourOpen(true);
  }, []);

  // Native Scintilla views float above all Lynx-rendered UI. While any
  // dialog/overlay is open, every visible pane carries suppressed=true
  // (via Editors → EditorPane) and the native side keeps it detached so the
  // dialog isn't hidden behind it.
  // Sash drags deliberately do NOT suppress: mousedown lands on a Lynx node,
  // so the whole drag sequence stays in the Lynx event pipeline — native
  // editors never see it. Detaching mid-drag blanked the panes and the
  // reattach+push churn was the main source of drag jank and lost highlights.
  // Sidebar add/rename are inline rows (no modal, no overlay) — they never
  // suppress the editors and stay out of this expression on purpose.
  const anyDialogOpen =
    templatePickerOpen || settingsOpen || versionsOpen || tourOpen || historyOpen
    || !!props.overlayActive;
  // Close our dialogs when the gallery overlay takes the page — they sit at a
  // higher z-index than the overlay and would otherwise float above it.
  useEffect(() => {
    if (!props.overlayActive) return;
    setTemplatePickerOpen(false);
    setSettingsOpen(false);
    setVersionsOpen(false);
    setHistoryOpen(false);
    setTourOpen(false);
  }, [props.overlayActive]);
  // Detach/attach itself is fully owned by the native `suppressed` attribute
  // on each pane (EditorPane): true detaches, false reattaches + restores the
  // frame. No imperative detach sweep, no reattach timer — the attribute
  // flows through the same render that shows/hides the dialog. JS keeps two
  // responsibilities: flush live text into state while the editors are
  // hidden, and (on close) re-push content — native setText is IDEMPOTENT
  // (identical content = strict no-op), so this heals drift without ever
  // clearing the style bytes.
  useEffect(() => {
    if (anyDialogOpen) {
      fiddle.flushAll();
    } else {
      for (const f of fiddle.snap.files.values()) {
        if (f.visible) fiddle.pushContent(f.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyDialogOpen]);

  const handleToggleGallery = useCallback(() => {
    if (props.galleryOpen) {
      props.onCloseGallery?.();
      return;
    }
    // No flush here: the anyDialogOpen effect flushes before detaching.
    props.onOpenGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.galleryOpen, props.onOpenGallery, props.onCloseGallery]);

  const handleOpenFolder = useCallback((path: string) => {
    const snap = loadLocalFiddle(path);
    if (!snap) {
      AppToaster.show({ message: `No fiddle files found in ${path}`, intent: 'warning', icon: 'warning-sign' });
      return;
    }
    fiddle.loadSnapshot(snap);
    appendOutput('info', `[Fiddle] Opened ${path}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme or editor font size changed: swap the App-level UI class and
  // re-theme every live native editor.
  const handleAppearanceChange = useCallback(() => {
    props.onThemeChange?.();
    applyEditorThemeAll(fiddle.snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onThemeChange, fiddle.snap]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    foundationApi()?.config?.set?.('fiddle.tour.seen', true);
  }, []);

  // Opens help.html in the system browser (no CEF webview in Lynxtron) —
  // main.ts resolves the shipped page and hands it to the OS opener.
  const handleOpenHelp = useCallback(() => {
    try {
      // @ts-ignore — bridge.call is callback-style, not a promise.
      NativeModules.bridge.call('openHelp', {}, (result: any) => {
        if (!result?.ok) appendOutput('error', '[Fiddle] Could not open the help page.');
      });
    } catch (_) {
      appendOutput('error', '[Fiddle] Could not open the help page.');
    }
  }, []);

  const refocusFind = useCallback(() => {
    setFindFocusKey(key => key + 1);
  }, []);

  const selectFindMatch = useCallback((editorId: string, match: CurrentFileMatch) => {
    fiddle.selectEditorRange(editorId, match.start, match.end);
  }, [fiddle.selectEditorRange]);

  const refreshFind = useCallback((
    query: string,
    preferredIndex = 0,
    shouldSelect = false,
  ) => {
    const editorId = findState.editorId;
    const text = editorId ? fiddle.readEditorText(editorId) ?? '' : '';
    const matches = editorId ? findCurrentFileMatches(text, query) : [];
    const activeMatchIndex = matches.length > 0
      ? Math.min(Math.max(preferredIndex, 0), matches.length - 1)
      : -1;

    setFindState(prev => ({
      ...prev,
      query,
      matches,
      activeMatchIndex,
      editorId,
    }));

    if (editorId && shouldSelect && query && activeMatchIndex >= 0) {
      selectFindMatch(editorId, matches[activeMatchIndex]);
    }
  }, [fiddle.readEditorText, findState.editorId, selectFindMatch]);

  const openFind = useCallback(() => {
    const editorId = fiddle.getFocusedEditorId();
    if (!editorId) return;
    if (findState.visible && findState.editorId === editorId) {
      refocusFind();
      return;
    }
    setFindState({
      visible: true,
      query: '',
      matches: [],
      activeMatchIndex: -1,
      editorId,
    });
    refocusFind();
  }, [
    fiddle.getFocusedEditorId,
    findState.editorId,
    findState.visible,
    refocusFind,
  ]);

  const closeFind = useCallback(() => {
    const editorId = findState.editorId;
    setFindState({
      visible: false,
      query: '',
      matches: [],
      activeMatchIndex: -1,
      editorId: null,
    });
    if (editorId) setTimeout(() => fiddle.selectEditor(editorId), 0);
  }, [fiddle.selectEditor, findState.editorId]);

  const updateFindQuery = useCallback((query: string) => {
    refreshFind(query, 0, !!query);
  }, [refreshFind]);

  const navigateFind = useCallback((direction: 'next' | 'previous') => {
    const query = findState.query;
    if (!query) return;
    const editorId = findState.editorId;
    const text = editorId ? fiddle.readEditorText(editorId) ?? '' : '';
    const matches = editorId ? findCurrentFileMatches(text, query) : [];
    const activeMatchIndex = getWrappedMatchIndex(
      findState.activeMatchIndex,
      matches.length,
      direction,
    );
    setFindState(prev => ({
      ...prev,
      matches,
      activeMatchIndex,
      editorId,
    }));
    if (editorId && activeMatchIndex >= 0) {
      selectFindMatch(editorId, matches[activeMatchIndex]);
    }
  }, [
    fiddle.readEditorText,
    findState.activeMatchIndex,
    findState.editorId,
    findState.query,
    selectFindMatch,
  ]);

  const handleRun = useCallback(() => {
    if (runner.isRunning) {
      const ok = runner.stop();
      appendOutput('info', ok ? `[Fiddle] Stopped pid=${runner.pid}` : `[Fiddle] Stop failed`);
      return;
    }
    // Showcase fiddle: write edits back into the downloaded workspace, then
    // run it. Prebuilt + clean → spawn directly. Otherwise prefer the
    // showcase's `start` script (build && launch — always surfaces a window)
    // over `dev`: dev pipelines are watch/HMR flows whose window launch is
    // gated on dev-server readiness and silently hangs under port collisions.
    if (fiddle.snap.source.kind === 'showcase' && fiddle.snap.source.ref) {
      const workspaceRoot = fiddle.snap.source.ref;
      const values = fiddle.values();
      if (!writeFiddleToWorkspace(workspaceRoot, values)) {
        appendOutput('error', `[Fiddle] Failed to write edits into ${workspaceRoot}`);
        return;
      }
      // Run just wrote the buffers to disk — they ARE the saved content now.
      // (Without this, one edited Run left the dirty flag latched forever.)
      fiddle.markSaved();
      const built = (() => { try { return !!showcaseApi()?.isBuilt?.(workspaceRoot); } catch (_) { return false; } })();
      // The preload's mtime check is the single authority on rebuild-needed:
      // writeFiddleToWorkspace skips unchanged files precisely so that edits
      // (and only edits) bump source mtimes. No parallel dirty heuristic.
      const sourceNewer = (() => {
        try { return !!showcaseApi()?.needsSourceRun?.(workspaceRoot); } catch (_) { return false; }
      })();
      if (built && !sourceNewer) {
        const pid = runner.start(workspaceRoot);
        if (pid) appendOutput('info', `[Fiddle] Run showcase: pid=${pid} ${workspaceRoot}`);
        else appendOutput('error', '[Fiddle] Showcase run failed to spawn.');
      } else {
        const hasStart = (() => {
          try {
            const pkg = JSON.parse(foundationApi()?.fs?.readFile?.(workspaceRoot + '/package.json') ?? '{}');
            return typeof pkg?.scripts?.start === 'string';
          } catch (_) { return false; }
        })();
        const why = built ? 'Source newer than build' : 'Not built';
        if (hasStart) {
          appendOutput('info', `[Fiddle] ${why} — build & launch (npm start)…`);
          void runner.startBuildRun(workspaceRoot).then(pid => {
            if (pid) appendOutput('info', `[Fiddle] Build & launch: pid=${pid} ${workspaceRoot}`);
            else appendOutput('error', '[Fiddle] Build & launch failed to start.');
          });
        } else {
          appendOutput('info', `[Fiddle] ${why} — no start script; running dev pipeline…`);
          void runner.startDev(workspaceRoot).then(pid => {
            if (pid) appendOutput('info', `[Fiddle] Dev run: pid=${pid} ${workspaceRoot}`);
            else appendOutput('error', '[Fiddle] Dev run failed to start.');
          });
        }
      }
      return;
    }
    if (currentShowcase && props.onRunShowcase) {
      props.onRunShowcase(currentShowcase);
      return;
    }
    const workspace = materializeFiddle(fiddle.snap, fiddle.values());
    if (!workspace) {
      appendOutput('error', '[Fiddle] Run: failed to materialize workspace.');
      return;
    }
    const localFolder = resolveLocalVersionFolder();
    if (localFolder) {
      const result = spawnRuntimeForWorkspace(workspace, localFolder);
      if (result.ok) appendOutput('info', `[Fiddle] Run [${selectedLocalName}]: pid=${result.pid}`);
      else appendOutput('error', `[Fiddle] Run failed: ${result.error ?? 'unknown'}`);
      return;
    }
    const pid = runner.start(workspace);
    if (pid) appendOutput('info', `[Fiddle] Run: pid=${pid} workspace=${workspace}`);
    else appendOutput('error', '[Fiddle] Run failed to spawn.');
  }, [currentShowcase, props.onRunShowcase, fiddle.snap, runner, resolveLocalVersionFolder, selectedLocalName]);

  const handleSave = useCallback(async () => {
    // A showcase fiddle already has a workspace on disk — ⌘S writes back to
    // it (the old IDE's save semantics). Folder-prompt saving remains for
    // template/gist fiddles that have no home yet.
    if (fiddle.snap.source.kind === 'showcase' && fiddle.snap.source.ref) {
      const workspaceRoot = fiddle.snap.source.ref;
      const ok = writeFiddleToWorkspace(workspaceRoot, fiddle.values());
      if (ok) {
        fiddle.markSaved();
        appendOutput('info', `[Fiddle] Saved to ${workspaceRoot}`);
        AppToaster.show({ message: `Saved to workspace`, intent: 'success', icon: 'floppy-disk' });
      } else {
        appendOutput('error', `[Fiddle] Save failed to ${workspaceRoot}`);
        AppToaster.show({ message: 'Save failed', intent: 'danger', icon: 'error' });
      }
      return;
    }
    const dir = await pickSaveFolder();
    if (!dir) return;
    const ok = writeFiddleToFolder(fiddle.snap, dir, fiddle.values());
    if (ok) {
      fiddle.markSaved();
      appendOutput('info', `[Fiddle] Saved to ${dir}`);
      AppToaster.show({ message: `Saved to ${dir}`, intent: 'success', icon: 'floppy-disk' });
    } else {
      appendOutput('error', `[Fiddle] Save failed to ${dir}`);
      AppToaster.show({ message: 'Save failed', intent: 'danger', icon: 'error' });
    }
  }, [fiddle]);

  const handlePublishGist = useCallback(async () => {
    const settings = foundationApi()?.config?.get?.('fiddle.settings') as any;
    const token = settings?.githubToken;
    if (!token) {
      AppToaster.show({
        message: 'Add a GitHub Personal Access Token in Settings → GitHub to publish gists.',
        intent: 'warning',
        icon: 'warning-sign',
        timeout: 6000,
      });
      setSettingsOpen(true);
      return;
    }
    const existingGistId = fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.ref ?? null : null;
    appendOutput('info', existingGistId ? `[Fiddle] Updating gist ${existingGistId}…` : `[Fiddle] Publishing new gist…`);
    try {
      const result = await publishGistFiddle(
        token,
        fiddle.values(),
        fiddle.snap.title,
        existingGistId,
      );
      fiddle.markSaved();
      appendOutput('info', `[Fiddle] Gist published: ${result.htmlUrl}`);
      AppToaster.show({
        message: existingGistId ? `Updated gist ${result.id}` : `Published gist ${result.id}`,
        intent: 'success',
        icon: 'cloud-upload',
      });
    } catch (e: any) {
      appendOutput('error', `[Fiddle] Gist publish failed: ${e?.message ?? String(e)}`);
      AppToaster.show({
        message: `Gist publish failed: ${e?.message ?? 'unknown'}`,
        intent: 'danger',
        icon: 'error',
        timeout: 6000,
      });
    }
  }, [fiddle]);

  // Showcase templates open like Electron Fiddle loads a fiddle from the web:
  // download/extract the package, then surface its source in the mosaic.
  // Run executes the workspace (see handleRun's showcase branch).
  const handlePickShowcase = useCallback((entry: ShowcaseEntry) => {
    setCurrentShowcase(entry);
    setTemplatePickerOpen(false);
    appendOutput('info', `[Fiddle] Fetching showcase "${entry.name}"…`);
    AppToaster.show({ message: `Downloading ${entry.name}…`, intent: 'primary', icon: 'cloud-download' });
    void (async () => {
      try {
        const workspaceRoot = await resolveShowcaseWorkspace(entry);
        if (!workspaceRoot) {
          appendOutput('error', `[Fiddle] Could not fetch showcase "${entry.name}".`);
          AppToaster.show({ message: `Fetch failed: ${entry.name}`, intent: 'danger', icon: 'error', timeout: 6000 });
          return;
        }
        const snap = loadShowcaseFiddle(entry, workspaceRoot);
        if (!snap) {
          appendOutput('error', `[Fiddle] No source files found in ${workspaceRoot}`);
          AppToaster.show({ message: `No source files in ${entry.name}`, intent: 'warning', icon: 'warning-sign' });
          return;
        }
        fiddle.loadSnapshot(snap);
        appendOutput('info', `[Fiddle] Opened "${entry.name}" (${snap.files.size} files) from ${workspaceRoot}`);
        AppToaster.show({ message: `Opened ${entry.name} — hit Run to launch it`, intent: 'success', icon: 'tick' });
      } catch (e: any) {
        appendOutput('error', `[Fiddle] Showcase open failed: ${e?.message ?? String(e)}`);
        AppToaster.show({ message: `Open failed: ${e?.message ?? 'unknown'}`, intent: 'danger', icon: 'error', timeout: 6000 });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiddle.loadSnapshot]);

  // Gallery "Open" hands its showcase over via props — consume it through the
  // same download→mosaic chain as the TemplatePicker. Declared after
  // handlePickShowcase (TDZ in hook deps is a load-time crash on Lynx).
  useEffect(() => {
    const entry = props.pendingShowcaseTemplate;
    if (!entry) return;
    props.onShowcaseTemplateConsumed?.();
    handlePickShowcase(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pendingShowcaseTemplate]);

  const handleLoadGist = useCallback((input: string) => {
    const id = parseGistId(input);
    if (!id) {
      appendOutput('warn', `[Fiddle] Not a recognizable gist id/url: ${input}`);
      return;
    }
    appendOutput('info', `[Fiddle] Loading gist ${id}…`);
    void loadGistFiddle(id)
      .then(snap => { fiddle.loadSnapshot(snap); appendOutput('info', `[Fiddle] Loaded gist ${id}.`); })
      .catch(e => appendOutput('error', `[Fiddle] Gist load failed: ${e?.message ?? String(e)}`));
  }, [fiddle]);

  // App-menu events (main.ts buildAppMenu sends `fiddle:*` global events,
  // plus the shared `ide:findInFile` command). NOTE: declared after the
  // handlers above — referencing them earlier is a TDZ crash at loadCard.
  //
  // Latest-ref dispatch: the handler table is rebuilt every render (cheap),
  // while the listeners register exactly ONCE. Depending on the handlers
  // directly re-ran this effect on every render (useFiddle/useRunner return
  // fresh objects), tearing down and re-adding ~14 listeners per keystroke
  // and resetting the dev command poll mid-drain.
  const menuHandlersRef = useRef<Record<string, (data?: any) => void>>({});
  menuHandlersRef.current = {
    'fiddle:newFiddle': () => setTemplatePickerOpen(true),
    'fiddle:openFolder': (data: any) => { const p = data?.path; if (typeof p === 'string' && p) handleOpenFolder(p); },
    'fiddle:save': () => { void handleSave(); },
    'fiddle:publish': () => { void handlePublishGist(); },
    'fiddle:run': () => handleRun(),
    'fiddle:stop': () => { if (runner.isRunning) runner.stop(); },
    'fiddle:toggleConsole': () => setConsoleShowing(v => !v),
    'fiddle:resetLayout': () => fiddle.resetLayout(),
    // Dev automation: drive sidebar interactions headlessly (eye toggle /
    // file select) — real mouse taps need Accessibility trust agents lack.
    'fiddle:toggleFile': (data: any) => { const id = data?.id; if (typeof id === 'string') fiddle.toggleEditor(id); },
    'fiddle:selectFile': (data: any) => { const id = data?.id; if (typeof id === 'string') fiddle.selectEditor(id); },
    'fiddle:showTour': () => setTourOpen(true),
    'fiddle:openSettings': () => setSettingsOpen(true),
    'fiddle:openHelp': () => handleOpenHelp(),
    'ide:findInFile': () => openFind(),
    'fiddle:persistNow': () => {
      fiddle.flushAll();
      fiddle.persistNow();
      // Ack so a pending ⌘Q can quit immediately instead of sleeping out
      // its dead-man fallback.
      // @ts-ignore
      try { NativeModules.bridge.send('persistDone', {}); } catch (_) {}
    },
    'fiddle:setTheme': (data: any) => {
      const t = data?.theme;
      if (t === 'dark' || t === 'light' || t === 'system') {
        setThemeSetting(t);
        handleAppearanceChange();
      }
    },
  };
  useEffect(() => {
    let emitter: any;
    try { emitter = (lynx as any).getJSModule?.('GlobalEventEmitter'); } catch (_) { return; }
    if (!emitter) return;
    const names = Object.keys(menuHandlersRef.current);
    const dispatchers = names.map((name): [string, (data?: any) => void] =>
      [name, (data?: any) => menuHandlersRef.current[name]?.(data)]);
    for (const [name, fn] of dispatchers) {
      try { emitter.addListener(name, fn); } catch (_) {}
    }
    // Dev-only: drain DEV_PRESET.commandFile and dispatch lines through the
    // same handler table, so shell automation can drive the app headlessly.
    let cmdPoll: ReturnType<typeof setInterval> | undefined;
    if (DEV_PRESET?.commandFile && isDevMode()) {
      const cmdFile = DEV_PRESET.commandFile;
      cmdPoll = setInterval(() => {
        for (const cmd of drainCommandFile(cmdFile)) {
          const handler = menuHandlersRef.current[cmd.name];
          if (handler) {
            appendOutput('info', `[DevCmd] ${cmd.raw}`);
            // A throwing handler must not kill the poll interval.
            try { handler(cmd.data); } catch (e: any) {
              appendOutput('error', `[DevCmd] ${cmd.name} failed: ${e?.message ?? String(e)}`);
            }
          }
          else appendOutput('warn', `[DevCmd] unknown command: ${cmd.raw}`);
        }
      }, 500);
    }
    return () => {
      if (cmdPoll) clearInterval(cmdPoll);
      for (const [name, fn] of dispatchers) {
        try { emitter.removeListener(name, fn); } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <view className="Fiddle bp3-dark">
      <Header
        onToggleConsole={() => setConsoleShowing(v => !v)}
        galleryOpen={props.galleryOpen}
        onToggleGallery={handleToggleGallery}
        onNewFiddle={() => setTemplatePickerOpen(true)}
        onRun={handleRun}
        onSave={handleSave}
        onPublishGist={handlePublishGist}
        onLoadGist={handleLoadGist}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={handleOpenHelp}
        onOpenVersionChooser={() => setVersionsOpen(true)}
        currentVersion={currentVersion}
        gistId={fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.ref ?? null : null}
        isConsoleShowing={isConsoleShowing}
        title={fiddle.snap.title}
        isEdited={fiddle.isEdited}
        isRunning={runner.isRunning}
      />
      <view className="FiddleBody">
        {/* Console at the BOTTOM (deliberate upstream divergence: app-wide
            surface shared with the gallery; bottom drawer is the devtool
            convention; content stays anchored on toggle). SplitContainer owns
            its live ratio — mirroring it into Fiddle state re-rendered the
            whole tree on every drag frame for nothing. */}
        <SplitContainer
          direction="vertical"
          initialRatio={0.75}
          minSizePx={80}
          collapsed={!isConsoleShowing}
          collapseTarget="second"
        >
          <view className="FiddleMain">
            <SplitContainer
              direction="horizontal"
              initialRatio={0.18}
              minSizePx={140}
            >
              <FiddleSidebar
                rootPath={props.rootPath}
                files={fiddle.snap.files}
                activeEditorId={fiddle.snap.activeEditorId}
                onSelectEditor={fiddle.selectEditor}
                onToggleEditor={fiddle.toggleEditor}
                onResetLayout={fiddle.resetLayout}
                onAddFile={fiddle.addFile}
                onRemoveFile={fiddle.removeFile}
                onRenameFile={fiddle.renameFile}
                onSetFileContent={fiddle.setFileContent}
              />
              <Editors
                files={fiddle.snap.files}
                activeEditorId={fiddle.snap.activeEditorId}
                onSelectEditor={fiddle.selectEditor}
                onHideEditor={fiddle.hideEditor}
                onResetLayout={fiddle.resetLayout}
                pushContent={fiddle.pushContent}
                findBar={findState.visible ? (
                  <CurrentFileFindBar
                    key={findState.editorId}
                    inputId={`current-file-find-input-${findFocusKey}`}
                    query={findState.query}
                    currentIndex={findState.activeMatchIndex}
                    total={findState.matches.length}
                    focusKey={findFocusKey}
                    onQueryChange={updateFindQuery}
                    onNext={() => navigateFind('next')}
                    onPrevious={() => navigateFind('previous')}
                    onClose={closeFind}
                  />
                ) : null}
                findBarEditorId={findState.visible ? findState.editorId : null}
                suppressed={anyDialogOpen}
              />
            </SplitContainer>
            {props.galleryOpen && props.gallery ? (
              <view className="FiddleGalleryLayer">{props.gallery}</view>
            ) : null}
          </view>
          <Outputs
            runningPid={runner.pid}
            runStartMs={runner.startMs}
            bumpKey={runner.runCount}
            externalPid={props.externalRunPid ?? null}
            onStopExternal={props.onStopExternalRun}
          />
        </SplitContainer>
      </view>
      {templatePickerOpen && (
        <TemplatePicker
          onPickBlank={() => { fiddle.loadTemplate('blank'); setCurrentShowcase(null); setTemplatePickerOpen(false); }}
          onPickHelloLynxtron={() => { fiddle.loadTemplate('hello-lynxtron'); setCurrentShowcase(null); setTemplatePickerOpen(false); }}
          onPickShowcase={handlePickShowcase}
          onCancel={() => setTemplatePickerOpen(false)}
        />
      )}
      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onAppearanceChange={handleAppearanceChange} />
      <VersionChooser
        isOpen={versionsOpen}
        currentVersion={currentVersion}
        selectedLocalName={selectedLocalName}
        onSelect={handleSelectLocalVersion}
        onClose={() => setVersionsOpen(false)}
      />
      <WelcomeTour isOpen={tourOpen} onClose={closeTour} />
      <HistoryDialog
        isOpen={historyOpen}
        gistId={fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.ref ?? null : null}
        onClose={() => setHistoryOpen(false)}
        onCheckout={(sha) => {
          const gistId = fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.ref : null;
          if (!gistId) return;
          appendOutput('info', `[Fiddle] Checkout gist ${gistId} @ ${sha.slice(0, 7)}…`);
          void loadGistFiddle(gistId, sha)
            .then(snap => {
              fiddle.loadSnapshot(snap);
              appendOutput('info', `[Fiddle] Loaded revision ${sha.slice(0, 7)}.`);
              AppToaster.show({
                message: `Loaded revision ${sha.slice(0, 7)}`,
                intent: 'success',
                icon: 'th-list',
              });
            })
            .catch(e => {
              appendOutput('error', `[Fiddle] Checkout failed: ${e?.message ?? String(e)}`);
              AppToaster.show({
                message: `Checkout failed: ${e?.message ?? 'unknown'}`,
                intent: 'danger',
                icon: 'error',
                timeout: 6000,
              });
            });
        }}
      />
      <ToasterHost />
    </view>
  );
}
