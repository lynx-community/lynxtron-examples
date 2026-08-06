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
import './history/HistoryDialog.css';
import { ToasterHost, AppToaster } from './bp';
import { useFiddle } from './state/useFiddle';
import { materializeFiddle } from './runner/materialize';
import { pickSaveFolder, writeFiddleToFolder } from './runner/save';
import { useRunner } from './runner/useRunner';
import { spawnRuntimeForWorkspace } from './runner/spawnRuntime';
import { loadGistFiddle, parseGistId, publishGistFiddle } from './gist/gist-loader';
import { loadLocalFiddle } from './runner/open';
import { resolveShowcaseWorkspace, loadShowcaseFiddle, loadSingleFiddle, writeFiddleToWorkspace } from './runner/showcase-open';
import { showcaseApi, appendFiddleOutput as appendOutput, type ShowcaseEntry, foundationApi } from '../store';
import { DEV_PRESET, isDevMode, drainCommandFile } from './dev-preset';
import { applyEditorThemeAll, setThemeSetting } from './theme';
import './Fiddle.css';
import './settings/Settings.css';
import './versions/VersionChooser.css';
import './tour/WelcomeTour.css';
import { PlatformOverlay } from '../components/shared/PlatformOverlay';

export interface FiddleProps {
  rootPath: string | null;
  onOpenGallery: () => void;
  onCloseGallery?: () => void;
  onRunShowcase?: (entry: ShowcaseEntry) => void;
  lynxtronVersion?: string;
  /** Showcase handed over by the gallery's Open — consumed once on mount/change. */
  pendingShowcaseTemplate?: ShowcaseEntry | null;
  onShowcaseTemplateConsumed?: () => void;
  /** Open ONE fiddle of a fiddle-collection showcase — its own files only. */
  pendingFiddleOpen?: { entry: ShowcaseEntry; id: string; title: string; upstream: string } | null;
  onFiddleOpenConsumed?: () => void;
  /** Build + launch the single fiddle currently loaded. */
  onRunFiddleSource?: (fiddleId: string) => void;
  /** An App-level platform overlay is active; close any competing Fiddle dialog. */
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
  /** Publish this Fiddle's own files to the App-level palette (Cmd+P). The
      palette is App-level because it must float above both products, but the
      rows have to come from whichever one is mounted — the Fiddle's editors
      here, the workspace's file index in the IDE. */
  onPaletteSourceChange?: (source: FiddlePaletteSource | null) => void;
}

/** What the Fiddle offers Cmd+P: its own editors, and how to reveal one. */
export interface FiddlePaletteSource {
  files: Array<{ id: string; name: string }>;
  open: (id: string) => void;
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
  const [mainRegionHeight, setMainRegionHeight] = useState(0);

  const handleMainRegionLayout = useCallback((e: any) => {
    const height = e?.detail?.height;
    if (typeof height !== 'number' || height <= 0) return;
    setMainRegionHeight(current => current === height ? current : height);
  }, []);
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

  // Dialogs, the gallery, the command palette, loading states, and toasts use
  // one shared cover-view host. Clay composites their children into one platform overlay slice,
  // so they can cover Scintilla without detaching its native view. Close local
  // dialogs when an App-level surface opens to keep overlay-slice order simple.
  useEffect(() => {
    if (!props.overlayActive) return;
    setTemplatePickerOpen(false);
    setSettingsOpen(false);
    setVersionsOpen(false);
    setHistoryOpen(false);
    setTourOpen(false);
  }, [props.overlayActive]);

  const handleToggleGallery = useCallback(() => {
    if (props.galleryOpen) {
      props.onCloseGallery?.();
      return;
    }
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

  // Publish the editor list upward whenever it changes, so Cmd+P on this
  // surface lists the fiddle's own files. selectEditor is the right activate:
  // it reveals a hidden file before focusing it, exactly like a sidebar click.
  const paletteSourceChanged = props.onPaletteSourceChange;
  useEffect(() => {
    if (!paletteSourceChanged) return;
    paletteSourceChanged({
      files: [...fiddle.snap.files.keys()].map(id => ({
        id,
        name: id.split('/').pop() || id,
      })),
      open: (id: string) => fiddle.selectEditor(id),
    });
    // Withdraw on unmount: App must not offer rows for a surface that is gone.
    return () => paletteSourceChanged(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteSourceChanged, fiddle.snap.files, fiddle.selectEditor]);

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

  const handleRun = useCallback(() => {
    if (runner.isRunning) {
      const ok = runner.stop();
      appendOutput('info', ok ? `[Fiddle] Stopped pid=${runner.pid}` : `[Fiddle] Stop failed`);
      return;
    }
    // A single loaded fiddle builds and runs ITSELF, not its collection.
    //
    // This MUST come before the showcase branch below: a loaded fiddle also has
    // `kind: 'showcase'` with a `ref`, so that branch swallows it and tries to
    // treat the fiddle's source folder as a showcase workspace — which meant
    // `npm install` inside fiddles/native-ui/dialogs/open-file-or-directory.
    const loadedFiddleId = fiddle.snap.source.fiddleId;
    if (loadedFiddleId && props.onRunFiddleSource) {
      const fiddleDir = fiddle.snap.source.ref;
      // Save edits first — the assembler copies from this folder.
      if (fiddleDir) {
        writeFiddleToWorkspace(fiddleDir, fiddle.values());
        fiddle.markSaved();
      }
      props.onRunFiddleSource(loadedFiddleId);
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
          appendOutput('info', `[Fiddle] ${why} — build & launch (pnpm start)…`);
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
  }, [currentShowcase, props.onRunShowcase, props.onRunFiddleSource, fiddle, runner, resolveLocalVersionFolder, selectedLocalName]);

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
  // Open a single fiddle: same collector, pointed at that fiddle's folder, so
  // the mosaic shows main/renderer/preload/styles and nothing else — the way
  // Electron Fiddle shows a fiddle.
  const handleOpenSingleFiddle = useCallback(
    (req: { entry: ShowcaseEntry; id: string; title: string; upstream: string }) => {
      setCurrentShowcase(req.entry);
      setTemplatePickerOpen(false);
      appendOutput('info', `[Fiddle] Opening ${req.id}…`);
      void (async () => {
        try {
          const workspaceRoot = await resolveShowcaseWorkspace(req.entry);
          if (!workspaceRoot) {
            appendOutput('error', `[Fiddle] Could not fetch "${req.entry.name}".`);
            return;
          }
          const snap = loadSingleFiddle(req.entry, workspaceRoot, req);
          if (!snap) {
            appendOutput('error', `[Fiddle] No source found for ${req.id}`);
            return;
          }
          fiddle.loadSnapshot(snap);
          appendOutput('info', `[Fiddle] Opened ${req.id} (${snap.files.size} files)`);
          AppToaster.show({ message: `Opened ${req.title} — hit Run`, intent: 'success', icon: 'tick' });
        } catch (e: any) {
          appendOutput('error', `[Fiddle] Open ${req.id} failed: ${e?.message ?? String(e)}`);
        }
      })();
    },
    [fiddle],
  );

  useEffect(() => {
    const req = props.pendingFiddleOpen;
    if (!req) return;
    props.onFiddleOpenConsumed?.();
    handleOpenSingleFiddle(req);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pendingFiddleOpen]);

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

  // App-menu events (main.ts buildAppMenu sends `fiddle:*` global events —
  // mirrors upstream's ipcMainManager.send flow). NOTE: declared after the
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
          <view className="FiddleMain" bindlayoutchange={handleMainRegionLayout}>
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
              />
            </SplitContainer>
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
      {props.galleryOpen && props.gallery ? (
        <PlatformOverlay priority={50}>
          <view
            className="FiddleGalleryLayer"
            style={mainRegionHeight > 0
              ? { top: '51px', height: `${mainRegionHeight}px` }
              : undefined}
          >
            {props.gallery}
          </view>
        </PlatformOverlay>
      ) : null}
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
