import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { SplitContainer } from '../components/Layout/SplitContainer';
import { Header } from './Header/Header';
import { Menu, MenuItem } from './bp/Menu';
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
import { pickSaveFolder, writeFiddleToFolder } from './runner/save';
import { useRunner } from './runner/useRunner';
import { resolveLocalRuntimeExecutable } from './runner/spawnRuntime';
import { loadGistFiddle, parseGistId, publishGistFiddle } from './gist/gist-loader';
import { loadLocalFiddle } from './runner/open';
import { resolveShowcaseWorkspace, loadProjectFiddle, loadShowcaseFiddle, loadSingleFiddle, projectOverlayForFiles, writeFiddleToWorkspace } from './runner/showcase-open';
import { createLatestOpenRequestGate } from './runner/latest-open-request';
import { BLANK_PROJECT_FILES } from './runner/blank-project';
import {
  showcaseApi,
  appendFiddleOutput as appendOutput,
  type ShowcaseEntry,
  foundationApi,
  getExposed,
  SHOWCASE_REGISTRY,
} from '../store';
import {
  findShowcaseEntryForWorkspace,
  resolveCurrentShowcaseWorkspacePath,
} from '../shared/showcase-workspace';
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
  /** Open the installer-bundled Hello showcase through the normal showcase path. */
  onOpenHelloShowcase: () => void;
  onCloseGallery?: () => void;
  lynxtronVersion?: string;
  /** Showcase handed over by the gallery's Open — consumed once on mount/change. */
  pendingShowcaseTemplate?: ShowcaseEntry | null;
  onShowcaseTemplateConsumed?: () => void;
  /** Open ONE fiddle of a fiddle-collection showcase — its own files only. */
  pendingFiddleOpen?: { entry: ShowcaseEntry; id: string; title: string; upstream: string } | null;
  onFiddleOpenConsumed?: () => void;
  /** Cancel App-level opens requested before a direct Fiddle selection. */
  onCancelPendingOpen?: () => void;
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
  /** Open the App-level palette. The commands bar is its only visible entry. */
  onOpenPalette?: () => void;
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
  const initialStarterRequested = useRef(false);
  const openRequests = useRef(createLatestOpenRequestGate());
  const [isConsoleShowing, setConsoleShowing] = useState(true);
  const devBoot = isDevMode() ? DEV_PRESET : null;
  const [templatePickerOpen, setTemplatePickerOpen] = useState(devBoot?.openSurface === 'templates');
  const [settingsOpen, setSettingsOpen] = useState(devBoot?.openSurface === 'settings');
  const [settingsPanel, setSettingsPanel] = useState<'general' | 'appearance' | 'execution' | 'github'>('general');
  const [versionsOpen, setVersionsOpen] = useState(devBoot?.openSurface === 'versions');
  const [tourOpen, setTourOpen] = useState(devBoot?.openSurface === 'tour');
  const [historyOpen, setHistoryOpen] = useState(devBoot?.openSurface === 'history');
  const [mainRegionHeight, setMainRegionHeight] = useState(0);
  const restoredShowcaseChecked = useRef(false);

  const refreshCurrentShowcase = useCallback(async () => {
    const source = fiddle.snap.source;
    if (source.kind !== 'showcase' || source.fiddleId || !source.ref) {
      return { projectRoot: source.ref ?? null, updated: false };
    }
    const entry = findShowcaseEntryForWorkspace(source.ref, SHOWCASE_REGISTRY);
    if (!entry) return { projectRoot: source.ref, updated: false };

    let updated = false;
    const projectRoot = await resolveCurrentShowcaseWorkspacePath(
      source.ref,
      SHOWCASE_REGISTRY,
      {
        onFetchStart: current => {
          updated = true;
          appendOutput('info', `[Lynxtron Go] Updating showcase from ${current.url}`);
        },
      },
    );
    if (!projectRoot || !updated) return { projectRoot, updated };

    const snapshot = loadShowcaseFiddle(entry, projectRoot);
    if (!snapshot) throw new Error(`Updated showcase has no editable source: ${projectRoot}`);
    fiddle.loadSnapshot(snapshot);
    appendOutput('info', `[Lynxtron Go] Updated showcase "${entry.name}"`);
    return { projectRoot, updated: true };
  }, [fiddle.loadSnapshot, fiddle.snap.source]);

  useEffect(() => {
    if (initialStarterRequested.current || fiddle.restoredSession || fiddle.snap.files.size > 0) return;
    initialStarterRequested.current = true;
    props.onOpenHelloShowcase();
  }, [fiddle.restoredSession, fiddle.snap.files.size, props.onOpenHelloShowcase]);

  useEffect(() => {
    if (restoredShowcaseChecked.current || !fiddle.restoredSession) return;
    restoredShowcaseChecked.current = true;
    void refreshCurrentShowcase().catch((error: any) => {
      appendOutput('error', `[Lynxtron Go] Showcase update failed: ${error?.message ?? String(error)}`);
    });
  }, [fiddle.restoredSession, refreshCurrentShowcase]);

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
    appendOutput('info', `[Lynxtron Go] Selected runtime: ${name ?? 'bundled ' + currentVersion}`);
  }, [currentVersion]);

  const resolveLocalVersionFolder = useCallback((): string | null => {
    if (!selectedLocalName) return null;
    const localVersions = (foundationApi()?.config?.get?.('fiddle.localVersions') as any[]) ?? [];
    const match = localVersions.find((v: any) => v.name === selectedLocalName);
    return match?.folder ?? null;
  }, [selectedLocalName]);

  const createBlankProject = useCallback(() => {
    props.onCancelPendingOpen?.();
    const requestId = openRequests.current.begin();
    setTemplatePickerOpen(false);
    appendOutput('info', '[Lynxtron Go] Creating project from the built-in starter…');
    void (async () => {
      try {
        const projectRoot = await showcaseApi()?.createCustomProject?.(BLANK_PROJECT_FILES);
        if (!openRequests.current.isCurrent(requestId)) return;
        if (!projectRoot) throw new Error('Built-in starter is unavailable.');
        const snap = loadProjectFiddle('Untitled Project', projectRoot, { kind: 'blank', ref: projectRoot });
        if (!snap) throw new Error(`Starter source is empty: ${projectRoot}`);
        fiddle.loadSnapshot(snap);
        appendOutput('info', `[Lynxtron Go] Created editable project at ${projectRoot}`);
      } catch (e: any) {
        if (!openRequests.current.isCurrent(requestId)) return;
        appendOutput('error', `[Lynxtron Go] New project failed: ${e?.message ?? String(e)}`);
      }
    })();
  }, [fiddle.loadSnapshot, props.onCancelPendingOpen]);

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
  //
  // The commands-bar overflow is owned here, not in Commands: the header has
  // overflow:hidden, so a menu anchored inside the bar is clipped before it can
  // open. That constraint is layout, not compositing — it outlived the
  // Scintilla z-order problem that first forced the hoist.
  const [overflowOpen, setOverflowOpen] = useState(false);
  // Reported by the main process on enter-/leave-full-screen: only it can see
  // the traffic lights come and go.
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const handler = (data: any) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        setFullScreen(!!parsed?.fullScreen);
      } catch (_) { /* malformed payload — keep the last known state */ }
    };
    let emitter: any = null;
    try {
      // @ts-ignore
      emitter = lynx.getJSModule('GlobalEventEmitter');
      emitter?.addListener('ide:fullScreen', handler);
    } catch (_) {}
    return () => { try { emitter?.removeListener('ide:fullScreen', handler); } catch (_) {} };
  }, []);
  const isMacPlatform = (() => {
    try { return getExposed()?.platform === 'darwin'; } catch (_) { return false; }
  })();
  /**
   * Detaching is not free: live text lives in the native view, and a reattached
   * pane does not repaint on its own. Flush before it goes and re-push after it
   * comes back — setText is idempotent, so the re-push heals drift without ever
   * clearing the style bytes. #46 removed this along with the dialog-detach it
   * belonged to; the gallery still needs it.
   */
  useEffect(() => {
    if (props.galleryOpen) {
      fiddle.flushAll();
    } else {
      for (const f of fiddle.snap.files.values()) {
        if (f.visible) fiddle.pushContent(f.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.galleryOpen]);

  useEffect(() => {
    if (!props.overlayActive) return;
    setTemplatePickerOpen(false);
    setSettingsOpen(false);
    setVersionsOpen(false);
    setHistoryOpen(false);
    setTourOpen(false);
    setOverflowOpen(false);
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
    props.onCancelPendingOpen?.();
    openRequests.current.begin();
    const snap = loadLocalFiddle(path);
    if (!snap) {
      AppToaster.show({ message: `No fiddle files found in ${path}`, intent: 'warning', icon: 'warning-sign' });
      return;
    }
    fiddle.loadSnapshot(snap);
    appendOutput('info', `[Lynxtron Go] Opened ${path}`);
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
        if (!result?.ok) appendOutput('error', '[Lynxtron Go] Could not open the help page.');
      });
    } catch (_) {
      appendOutput('error', '[Lynxtron Go] Could not open the help page.');
    }
  }, []);

  const handleRun = useCallback(() => {
    if (runner.isRunning) {
      const ok = runner.stop();
      appendOutput('info', ok ? `[Lynxtron Go] Stopped pid=${runner.pid}` : `[Lynxtron Go] Stop failed`);
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
    void (async () => {
      try {
        let projectRoot = fiddle.snap.source.ref ?? null;
        let values = fiddle.values();
        let updated = false;
        if (fiddle.snap.source.kind === 'showcase' && !loadedFiddleId) {
          const refreshed = await refreshCurrentShowcase();
          projectRoot = refreshed.projectRoot;
          updated = refreshed.updated;
          if (updated) values = {};
        }
        if (!projectRoot) {
          projectRoot = await showcaseApi()?.createCustomProject?.(projectOverlayForFiles(values)) ?? null;
          if (!projectRoot) throw new Error('Could not create a complete project workspace.');
          const snap = loadProjectFiddle(
            fiddle.snap.title,
            projectRoot,
            { ...fiddle.snap.source, ref: projectRoot },
          );
          if (!snap) throw new Error(`Created project has no editable source: ${projectRoot}`);
          fiddle.loadSnapshot(snap);
        } else if (!updated && !writeFiddleToWorkspace(projectRoot, values)) {
          throw new Error(`Failed to write edits into ${projectRoot}`);
        }
        fiddle.markSaved();

        const runtimeExecutable = resolveLocalRuntimeExecutable(resolveLocalVersionFolder());
        const pid = await runner.runProject(projectRoot, runtimeExecutable ?? undefined);
        if (pid) {
          appendOutput('info', `[Lynxtron Go] Run${selectedLocalName ? ` [${selectedLocalName}]` : ''}: pid=${pid} ${projectRoot}`);
        } else {
          appendOutput('error', '[Lynxtron Go] Run failed to spawn.');
        }
      } catch (e: any) {
        appendOutput('error', `[Lynxtron Go] Run failed: ${e?.message ?? String(e)}`);
      }
    })();
  }, [props.onRunFiddleSource, fiddle, refreshCurrentShowcase, runner, resolveLocalVersionFolder, selectedLocalName]);

  const handleSave = useCallback(async () => {
    // A showcase fiddle already has a workspace on disk — ⌘S writes back to
    // it (the old IDE's save semantics). Folder-prompt saving remains for
    // template/gist fiddles that have no home yet.
    if (fiddle.snap.source.ref) {
      const workspaceRoot = fiddle.snap.source.ref;
      const ok = writeFiddleToWorkspace(workspaceRoot, fiddle.values());
      if (ok) {
        fiddle.markSaved();
        appendOutput('info', `[Lynxtron Go] Saved to ${workspaceRoot}`);
        AppToaster.show({ message: `Saved to workspace`, intent: 'success', icon: 'floppy-disk' });
      } else {
        appendOutput('error', `[Lynxtron Go] Save failed to ${workspaceRoot}`);
        AppToaster.show({ message: 'Save failed', intent: 'danger', icon: 'error' });
      }
      return;
    }
    const dir = await pickSaveFolder();
    if (!dir) return;
    const ok = writeFiddleToFolder(fiddle.snap, dir, fiddle.values());
    if (ok) {
      fiddle.markSaved();
      appendOutput('info', `[Lynxtron Go] Saved to ${dir}`);
      AppToaster.show({ message: `Saved to ${dir}`, intent: 'success', icon: 'floppy-disk' });
    } else {
      appendOutput('error', `[Lynxtron Go] Save failed to ${dir}`);
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
    const existingGistId = fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.gistId ?? null : null;
    appendOutput('info', existingGistId ? `[Lynxtron Go] Updating gist ${existingGistId}…` : `[Lynxtron Go] Publishing new gist…`);
    try {
      const result = await publishGistFiddle(
        token,
        fiddle.values(),
        fiddle.snap.title,
        existingGistId,
      );
      fiddle.markSaved();
      appendOutput('info', `[Lynxtron Go] Gist published: ${result.htmlUrl}`);
      AppToaster.show({
        message: existingGistId ? `Updated gist ${result.id}` : `Published gist ${result.id}`,
        intent: 'success',
        icon: 'cloud-upload',
      });
    } catch (e: any) {
      appendOutput('error', `[Lynxtron Go] Gist publish failed: ${e?.message ?? String(e)}`);
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
    const requestId = openRequests.current.begin();
    setTemplatePickerOpen(false);
    appendOutput('info', `[Lynxtron Go] Fetching showcase "${entry.name}"…`);
    AppToaster.show({ message: `Downloading ${entry.name}…`, intent: 'primary', icon: 'cloud-download' });
    void (async () => {
      try {
        const workspaceRoot = await resolveShowcaseWorkspace(entry);
        if (!openRequests.current.isCurrent(requestId)) {
          appendOutput('info', `[Lynxtron Go] Ignored stale showcase open: ${entry.name}`);
          return;
        }
        if (!workspaceRoot) {
          appendOutput('error', `[Lynxtron Go] Could not fetch showcase "${entry.name}".`);
          AppToaster.show({ message: `Fetch failed: ${entry.name}`, intent: 'danger', icon: 'error', timeout: 6000 });
          return;
        }
        const snap = loadShowcaseFiddle(entry, workspaceRoot);
        if (!snap) {
          appendOutput('error', `[Lynxtron Go] No source files found in ${workspaceRoot}`);
          AppToaster.show({ message: `No source files in ${entry.name}`, intent: 'warning', icon: 'warning-sign' });
          return;
        }
        fiddle.loadSnapshot(snap);
        appendOutput('info', `[Lynxtron Go] Opened "${entry.name}" (${snap.files.size} files) from ${workspaceRoot}`);
        AppToaster.show({ message: `Opened ${entry.name} — hit Run to launch it`, intent: 'success', icon: 'tick' });
      } catch (e: any) {
        if (!openRequests.current.isCurrent(requestId)) return;
        appendOutput('error', `[Lynxtron Go] Showcase open failed: ${e?.message ?? String(e)}`);
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
      const requestId = openRequests.current.begin();
      setTemplatePickerOpen(false);
      appendOutput('info', `[Lynxtron Go] Opening ${req.id}…`);
      void (async () => {
        try {
          const workspaceRoot = await resolveShowcaseWorkspace(req.entry);
          if (!openRequests.current.isCurrent(requestId)) return;
          if (!workspaceRoot) {
            appendOutput('error', `[Lynxtron Go] Could not fetch "${req.entry.name}".`);
            return;
          }
          const snap = loadSingleFiddle(req.entry, workspaceRoot, req);
          if (!snap) {
            appendOutput('error', `[Lynxtron Go] No source found for ${req.id}`);
            return;
          }
          fiddle.loadSnapshot(snap);
          appendOutput('info', `[Lynxtron Go] Opened ${req.id} (${snap.files.size} files)`);
          AppToaster.show({ message: `Opened ${req.title} — hit Run`, intent: 'success', icon: 'tick' });
        } catch (e: any) {
          if (!openRequests.current.isCurrent(requestId)) return;
          appendOutput('error', `[Lynxtron Go] Open ${req.id} failed: ${e?.message ?? String(e)}`);
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
      appendOutput('warn', `[Lynxtron Go] Not a recognizable gist id/url: ${input}`);
      return;
    }
    props.onCancelPendingOpen?.();
    const requestId = openRequests.current.begin();
    appendOutput('info', `[Lynxtron Go] Loading gist ${id}…`);
    void loadGistFiddle(id)
      .then(async gistSnap => {
        if (!openRequests.current.isCurrent(requestId)) return;
        const values = Object.fromEntries([...gistSnap.files].map(([name, file]) => [name, file.currentText]));
        const projectRoot = await showcaseApi()?.createCustomProject?.(projectOverlayForFiles(values));
        if (!openRequests.current.isCurrent(requestId)) return;
        if (!projectRoot) throw new Error('Could not create a project for this gist.');
        const snap = loadProjectFiddle(
          gistSnap.title,
          projectRoot,
          { kind: 'gist', ref: projectRoot, gistId: id },
        );
        if (!snap) throw new Error(`Created gist project is empty: ${projectRoot}`);
        fiddle.loadSnapshot(snap);
        appendOutput('info', `[Lynxtron Go] Loaded gist ${id}.`);
      })
      .catch(e => {
        if (!openRequests.current.isCurrent(requestId)) return;
        appendOutput('error', `[Lynxtron Go] Gist load failed: ${e?.message ?? String(e)}`);
      });
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
    // Dev automation drives these direct actions to cover async-open races.
    'fiddle:newBlank': () => createBlankProject(),
    'fiddle:openHello': () => props.onOpenHelloShowcase(),
    'fiddle:openFolder': (data: any) => { const p = data?.path; if (typeof p === 'string' && p) handleOpenFolder(p); },
    'fiddle:save': () => { void handleSave(); },
    'fiddle:publish': () => { void handlePublishGist(); },
    'fiddle:run': () => handleRun(),
    'fiddle:stop': () => { if (runner.isRunning) runner.stop(); },
    'fiddle:toggleConsole': () => setConsoleShowing(v => !v),
    // The gallery is the largest surface in the app and had no automation
    // entry, so it could only ever be checked by hand.
    'fiddle:toggleGallery': () => handleToggleGallery(),
    'fiddle:resetLayout': () => fiddle.resetLayout(),
    // Dev automation: drive sidebar interactions headlessly (eye toggle /
    // file select) — real mouse taps need Accessibility trust agents lack.
    'fiddle:toggleFile': (data: any) => { const id = data?.id; if (typeof id === 'string') fiddle.toggleEditor(id); },
    'fiddle:selectFile': (data: any) => { const id = data?.id; if (typeof id === 'string') fiddle.selectEditor(id); },
    'fiddle:showTour': () => setTourOpen(true),
    'fiddle:openSettings': (data: any) => {
      const p = data?.panel;
      if (p === 'general' || p === 'appearance' || p === 'execution' || p === 'github') setSettingsPanel(p);
      setSettingsOpen(true);
    },
    'fiddle:openVersions': () => setVersionsOpen(true),
    'fiddle:openHelp': () => handleOpenHelp(),
    'fiddle:persistNow': () => {
      fiddle.flushAll();
      fiddle.persistNow();
      // Ack so a pending ⌘Q or reload can proceed immediately instead of
      // sleeping out its dead-man fallback.
      // @ts-ignore
      try { NativeModules.bridge.send('persistDone', {}); } catch (_) {}
    },
    // Same shape as the ide:fullScreen event the main process sends, so
    // automation can exercise the layout response without the OS: the window
    // chrome cannot be driven from here, but everything downstream of the flag
    // can. Sits with setTheme because it is the same kind of thing — a piece of
    // app state that only the host can normally change.
    'fiddle:setFullScreen': (data: any) => {
      setFullScreen(!!data?.fullScreen);
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
      {/* Routed through the platform overlay, not rendered inside the bar. Two
          separate walls stand between a bar-anchored menu and the screen: the
          header clips its own children, and the native editor still paints in a
          platform layer that ordinary Lynx z-index cannot cross. The cover-view
          host clears both — it is outside the header and it is a platform layer
          of its own. */}
      {overflowOpen ? (
        <PlatformOverlay priority={120}>
          <view className="commands-overflow-backdrop" bindtap={() => setOverflowOpen(false)} />
          <view className="commands-overflow">
            <Menu>
              <MenuItem
                icon="add"
                text="New Fiddle"
                label={isMacPlatform ? '\u2318N' : 'Ctrl+N'}
                disabled={!!props.galleryOpen}
                onClick={() => { setOverflowOpen(false); setTemplatePickerOpen(true); }}
              />
              <MenuItem
                icon="floppy-disk"
                text="Save Fiddle"
                label={isMacPlatform ? '\u2318S' : 'Ctrl+S'}
                disabled={!!props.galleryOpen}
                onClick={() => { setOverflowOpen(false); void handleSave(); }}
              />
              <MenuItem
                icon="history"
                text="Gist History"
                disabled={fiddle.snap.source.kind !== 'gist' || !!props.galleryOpen}
                onClick={() => { setOverflowOpen(false); setHistoryOpen(true); }}
              />
              <MenuItem
                icon="help"
                text="Help"
                onClick={() => { setOverflowOpen(false); handleOpenHelp(); }}
              />
            </Menu>
          </view>
        </PlatformOverlay>
      ) : null}
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
        onOpenPalette={props.onOpenPalette}
        fullScreen={fullScreen}
        overflowOpen={overflowOpen}
        onToggleOverflow={() => setOverflowOpen(v => !v)}
        currentVersion={currentVersion}
        gistId={fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.gistId ?? null : null}
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
                suppressed={!!props.galleryOpen}
              />
            </SplitContainer>
            {/* In the tree, not in the platform overlay. The gallery REPLACES
                the editors rather than floating over them, so the native views
                detach and there is nothing left for a cover-view to cover — and
                a plain view leaves the rest of the window live, which is the
                whole point: the bar's pressed Gallery toggle is the way back.
                A cover-view here made the entire window deaf to input, so the
                only exit sat in the one place that could not be clicked. */}
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
          onPickBlank={createBlankProject}
          onPickHelloLynxtron={() => { setTemplatePickerOpen(false); props.onOpenHelloShowcase(); }}
          onBrowseShowcases={() => { setTemplatePickerOpen(false); props.onOpenGallery(); }}
          onCancel={() => setTemplatePickerOpen(false)}
        />
      )}
      <Settings isOpen={settingsOpen} initialPanel={settingsPanel} onClose={() => setSettingsOpen(false)} onAppearanceChange={handleAppearanceChange} />
      <VersionChooser
        isOpen={versionsOpen}
        isMac={isMacPlatform}
        currentVersion={currentVersion}
        selectedLocalName={selectedLocalName}
        onSelect={handleSelectLocalVersion}
        onClose={() => setVersionsOpen(false)}
      />
      <WelcomeTour isOpen={tourOpen} onClose={closeTour} />
      <HistoryDialog
        isOpen={historyOpen}
        gistId={fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.gistId ?? null : null}
        onClose={() => setHistoryOpen(false)}
        onCheckout={(sha) => {
          const gistId = fiddle.snap.source.kind === 'gist' ? fiddle.snap.source.gistId : null;
          if (!gistId) return;
          appendOutput('info', `[Lynxtron Go] Checkout gist ${gistId} @ ${sha.slice(0, 7)}…`);
          void loadGistFiddle(gistId, sha)
            .then(async gistSnap => {
              const values = Object.fromEntries([...gistSnap.files].map(([name, file]) => [name, file.currentText]));
              const projectRoot = await showcaseApi()?.createCustomProject?.(projectOverlayForFiles(values));
              if (!projectRoot) throw new Error('Could not create a project for this gist revision.');
              const snap = loadProjectFiddle(
                gistSnap.title,
                projectRoot,
                { kind: 'gist', ref: projectRoot, gistId },
              );
              if (!snap) throw new Error(`Created gist project is empty: ${projectRoot}`);
              fiddle.loadSnapshot(snap);
              appendOutput('info', `[Lynxtron Go] Loaded revision ${sha.slice(0, 7)}.`);
              AppToaster.show({
                message: `Loaded revision ${sha.slice(0, 7)}`,
                intent: 'success',
                icon: 'th-list',
              });
            })
            .catch(e => {
              appendOutput('error', `[Lynxtron Go] Checkout failed: ${e?.message ?? String(e)}`);
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
