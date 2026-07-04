# Lynxtron Fiddle Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Electron Fiddle's UI, UX, and functionality onto Lynxtron GO so that a Fiddle-shaped playground replaces the current VS Code-style IDE page and becomes the app's landing screen, with the existing showcases available as downloadable templates.

**Architecture:** Reuse the existing Scintilla-based editor, `SplitContainer`, `Sidebar`, `TabBar`, `StatusBar`, and preload IPC bridges already shipped in `lynxtron-go`. Layer a Fiddle-shaped shell on top: a Commands header (settings / version chooser / run / console toggle / gist address bar), a three-pane split (Outputs on top, Sidebar + Editors below), a Runner that spawns a fresh Lynxtron process for the current fiddle, and a template picker whose corpus is `showcase-registry.json`. Blueprint.js components are re-implemented in ReactLynx as a minimal `<Button>` / `<Icon>` / `<Dialog>` kit under `components/BP/` — same class names (`bp3-*`) so we can copy Fiddle's LESS variables largely as-is. State stays in a MobX store per Fiddle's model, since MobX is a runtime lib and works under ReactLynx.

**Tech Stack:** ReactLynx (`@lynx-js/react`), Rspeedy + Rspack, MobX, Scintilla native editor (workspace pkg `lynxtron-scintilla-editor`), Lynxtron runtime APIs (`app`, `LynxWindow`, `dialog`, `Menu` from `@lynx-js/lynxtron`), existing showcase CLI (`@lynxtron-showcases/cli`) for downloading templates.

**Reference source trees:**
- Fiddle: `/tmp/electron-fiddle/src/` (React 16, Blueprint 3, Monaco, react-mosaic, MobX)
- Lynxtron: `~/github/lynxtron/`
- Lynxtron docs: https://deploy-preview-1143--lynx-doc.netlify.app/next/lynxtron/introduction
- ReactLynx / Lynx docs: https://lynxjs.org/
- Best practices skill: `/Users/bytedance/.agents/skills/reactlynx-best-practices/SKILL.md`
- Lynx DevTool skill: `/Users/bytedance/.agents/skills/lynx-devtool/SKILL.md`

**Dev port:** Lynx UI dev server → **5817** (chosen distinct from Rspeedy default 3000 and Verdaccio 4873). Set via `rspeedy.dev.server.port` in `lynx.config.ts`.

---

## Phase Roadmap (milestone view)

| Phase | Deliverable | Rough size |
|-------|-------------|------------|
| **P1 — Visual shell** | Fiddle-shaped layout renders as landing screen. Header + Sidebar + Editors area + Outputs pane. Uses existing Scintilla editor and existing `SplitContainer`. No Runner, no version chooser wired yet — buttons are inert. Old GalleryHome preserved but unlinked; the App routes to `<Fiddle />` on boot. | ~600 LOC + CSS |
| **P2 — Minimal BP UI kit** | `components/BP/{Button,Icon,ControlGroup,Dialog,Menu,Select}.tsx` implementing the Blueprint 3 subset Fiddle uses, class-name-compatible so we can port Fiddle's LESS with minimal edits. | ~500 LOC + CSS |
| **P3 — Fiddle state model** | Port `AppState`, `EditorMosaic`, `FileManager` (MobX) into `lynxtron-go/src/app/fiddle/`. Files = the current fiddle's editable set. Wire Scintilla to the state. Save/load from disk via existing preload fs bridge. | ~1200 LOC |
| **P4 — Templates + Gallery integration** | Bundled starter templates (`blank`, `hello-lynxtron`). Template picker replaces GalleryHome's landing role. Existing showcases become downloadable templates: reuse `@lynxtron-showcases/cli` install path; each showcase materialized into a temp fiddle workspace. Gallery reachable as a "Browse showcases" side panel / modal. | ~800 LOC |
| **P5 — Runner + Console** | Runner spawns a fresh Lynxtron process for the current fiddle (analogous to `@electron/fiddle-core`'s runner). Wire stdout/stderr into the Outputs pane. Handle Stop, exit codes, isolated-run indicator. | ~600 LOC |
| **P6 — Version chooser** | Lynxtron runtime version picker (analogous to Fiddle's Electron version chooser). Pull available versions from `showcase-registry.json`'s `catalog:` mechanism or a new local index. Persist choice per fiddle. | ~400 LOC |
| **P7 — Gist / share loader** | AddressBar + GistActionButton port. Load fiddle from GitHub gist; save fiddle as gist (auth via existing GitHub flow if present, else document as follow-up). | ~500 LOC |
| **P8 — Settings pane** | Port `settings-*.tsx` (General / Appearance / Font / Execution). Persist via existing config store preload. | ~600 LOC |
| **P9 — Dialogs, tour, polish** | Welcome tour, generic dialog, bisect (optional, defer if scope creeps), add-version, add-theme. Icon/asset audit against Fiddle. Final CSS pass for pixel-close parity. | ~400 LOC |

**Total (rough):** ~5,600 LOC across ~40–60 files, plus CSS. Actual will vary as we hit surprises.

**Only Phase 1 is fully detailed below.** Each subsequent phase gets its own detailed plan file (`docs/superpowers/plans/2026-XX-XX-lynxtron-fiddle-P<N>-<name>.md`) written just before that phase starts, so the plan can use real discoveries from earlier phases instead of speculation.

---

## Session 1 Status (2026-07-01)

**Delivered on branch `feat/lynxtron-fiddle` (14 commits):**

| Phase | State | Notes |
|-------|-------|-------|
| Plan doc | ✓ | This file |
| P1 Visual shell | ✓ | Dev port 5817, Fiddle module scaffold, App.tsx routes to `<Fiddle />` |
| P2 BP UI kit | ✓ | Button/Icon/ButtonGroup/ControlGroup/InputGroup/Dialog/Callout/Checkbox/FormGroup + Intent/Classes |
| P3 State model | ✓ | `useFiddle()` hook, Scintilla swap-on-tab-switch, Hello Lynxtron + Blank templates |
| P4 Templates | ✓ | TemplatePicker with Blank + Hello Lynxtron + all 9 showcase-registry entries |
| P5 Runner + Console | ✓ | Outputs polls `showcaseApi.readProcessOutput`; Run for showcases via `runShowcaseEntry` |
| P5.5 Template runner | ✓ | `materializeFiddle` → `<tmpdir>/lynxtron-fiddle-<ts>/dist/desktop/*` → `showcaseApi.run(workspace)` |
| P6 Version chooser | ✓ (stub) | Dialog shows current version; catalog/download deferred |
| P7 Gist loader | ✓ (public only) | `parseGistId` + `loadGistFiddle` from `api.github.com/gists/:id`; publish gist requires GitHub auth (TBD) |
| P8 Settings | ✓ | General/Appearance/Execution/GitHub panels with real controls (theme, font size, block accel, tour toggle, runtime flags, GH token) persisted via `foundation.config.set/get` |
| P9 Polish | ⏳ partial | Dialog primitive ✓; WelcomeTour ✓; icon-font parity ✗ (unicode glyphs used); NonIdealState/Alert/Toaster/Menu/Tree/Spinner unshipped; final CSS diff pass not done |

**Bridge additions:**
- `foundation.fs.mkdirp(dir)`, `foundation.fs.tmpdir()`, `foundation.fs.join(...)` — for materializing fiddle workspaces
- `bridge.saveFolder` command in `main.ts` — for Save Fiddle directory dialog

**Not implemented yet (parity gaps):**
- Save-as-gist (needs GitHub OAuth via Octokit; token entry exists in Settings but the publish flow isn't wired)
- Runtime version download/switch (Fiddle's `@electron/fiddle-core`-style catalog resolver isn't ported)
- 25+ BP components: NonIdealState, Alert, Toaster, Menu, MenuItem, Tree, Spinner, Card, Popover, Divider, Radio, RadioGroup, FileInput, Tag, ContextMenu, AnchorButton — add JIT as phases actually use them
- Icon-font parity: `Icon` renders unicode glyphs (`⚙`, `▶`, etc.), not the Blueprint icon set
- History panel, bisect handler
- Sidebar file tree matching Fiddle's `sidebar-file-tree.tsx` — Fiddle sidebar currently shows only the fixed editor id list
- Save current fiddle back to gist
- Local-fiddle workspace (open an existing folder as a fiddle)
- Type-checker / npm-search integrations from `electron-types.ts` and `npm-search.tsx`
- Menu-bar / macOS titlebar polish
- Full theming pipeline (Fiddle's `themes.ts` with per-theme JSON files)

**Visual verification status:**
Both builds green end-to-end (`pnpm rspeedy build` 486 KB Lynx UI, `pnpm rspack build` desktop main). Launching against the new bundle is blocked in this session by a pre-existing `pnpm --filter lynxtron-go dev` process started at 01:25 AM in the parent repo (before this session) which holds the Lynxtron singleton lock. To verify: stop that dev server, then `cd .worktrees/lynxtron-fiddle/lynxtron-go && ./node_modules/.bin/lynxtron ./dist/desktop`.

---

## Session 1 Final State (2026-07-01, 40 commits landed)

Live-verified via lynx-devtool at localhost:8901 ("Lynxtron Fiddle (Claude)"). Renamed via `app.setName('Lynxtron Fiddle (Claude)')`. Bundle 508 KB. `LYNXTRON_ALLOW_MULTI=1` env var opts out of the singleton lock so the worktree runs alongside your existing dev server.

**Functional pipelines wired end-to-end** (each verified by running):
- Boot → Fiddle shell renders (IDE component removed, Fiddle is sole main page)
- Template picker → Blank / Hello Lynxtron / 9 showcase entries
- Sidebar Files section + Modules section (matches upstream layout)
- Editors area with existing Scintilla panel + TabBar
- Console live-streaming stdout/stderr from spawned processes
- Runner: template-fiddle materialize + `showcase.run` + Stop toggle + uptime pill + auto-clear on Run
- Save Fiddle: native saveFolder dialog + writeFiddleToFolder + markSaved
- Gist load (public via `api.github.com/gists/:id`)
- Gist publish/update via PAT (POST/PATCH)
- Gist History dialog: fetch `/commits`, list revisions with delta tags, **Checkout** loads that revision
- Welcome Tour: 4-step dialog with dismissal persisted
- Settings 4 tabs: General (tour toggle, block accelerators), Appearance (theme, font size, Add Theme), Execution (runtime flags), GitHub (real Sign In flow via PAT validated against /user)
- Version chooser: catalog fetch from `bnpm.byted.org` → npm registry fallback, prerelease toggle, LOCAL section with tap-to-select persisted, Download button runs `npm pack + tar -xzf` into `~/.lynxtron-fiddle/runtimes/`, auto-registers as LocalVersion
- Run against selected local runtime via `foundation.exec.runAsync`

**Fiddle Dark palette adopted** across Header/Sidebar/Outputs/Dialog/Buttons/Input using exact tokens from `/tmp/electron-fiddle/src/themes-defaults.ts`: `background-1/2/3/4` = `#2f3241`/`#1d2427`/`#2c2e3b`/`#21232d`, `foreground-1` = `#9feafa` cyan accent, `text-color-1/3` = `#ffffff`/`#dcdcdc`, `border-color-1/2` = `#5c5f71`/`#1e2527`.

**Bridge additions** in preload/main:
- `foundation.fs.mkdirp/tmpdir/homedir/exists/join`
- `foundation.exec.runAsync(cmd, args, {onLine, onExit})`
- `foundation.config.get/set` (existing, extensively used for `fiddle.settings`, `fiddle.localVersions`, `fiddle.selectedLocalVersion`, `fiddle.githubUser`, `fiddle.githubToken`, `fiddle.tour.seen`)
- `bridge.saveFolder`, `bridge.openExternal`
- `showcaseApi.stop(pid)`, `showcaseApi.isRunning(pid)` (added)

**Known Lynx-runtime gotchas** (recorded in `~/.claude/projects/-Users-bytedance-github-lynxtron-showcases/memory/reference_lynx_element_gotchas.md`):
- `<inline-svg>` doesn't exist — Lynx has `<svg content="…"/>` (renders blank inside minimal buttons in current runtime)
- `<image src="data:image/svg+xml;base64,…"/>` doesn't render either in current runtime
- Icons currently ship as unicode glyphs — a Lynx-side SVG paint fix or bundled PNG icon set is a follow-up
- `<text>` in narrow flex children wraps by default → needs `lines: 1` + `width: fit-content` + `white-space: nowrap`
- `btoa` isn't in the Lynx runtime — hand-rolled encoder needed for base64
- rspeedy → `output/bundle/lynx/`, but the launched app reads `dist/desktop/` — need `pnpm rspack build` OR manual `cp` after each rebuild for `Page.reload` to pick up new bundle

**Follow-up sessions can focus on**:
1. SVG icon rendering fix (Lynx runtime side, or ship PNG icons as bundled assets)
2. Per-dialog exact-pixel polish against Fiddle's `dialogs.less`
3. `dialog-bisect` port (user deferred as low-value)
4. sidebar `Modules` npm-search algolia integration
5. Runtime version SPAWN — currently spawn works via `foundation.exec.runAsync`; the tarball layout for `.app/Contents/MacOS/lynxtron` inside the extracted package may differ (needs validation with a real download)
6. Address bar responsive width transitions matching upstream (`min(max(200px, 30vw), 420px)` etc.)
7. macOS titlebar integration — Fiddle uses `env(titlebar-area-x)` etc. for `commands.is-mac` layout

---

## Session 2 Status (2026-07-01, branch claude/zealous-noyce-e9e9f5, "Fable 5")

Continues from Session 1 (fast-forwarded from feat/lynxtron-fiddle). Landed:

| Item | State | Notes |
|------|-------|-------|
| Blueprint icon font | ✓ | Real `icons-16.ttf` via `lynx.addFont(data:font/ttf;base64,…)` (`bp/icon-font.ts`, 67 codepoints). SVG paths all render blank on this runtime; data: font URLs decode natively in the Clay text stack. `AddFont`'s JS callback fires unconditionally — verify visually. |
| Commands bar parity | ✓ | Upstream 3-region layout: cog / version+run ControlGroup / console — centered ellipsized title — address bar (geosearch icon, embedded Load button, gist-URL validation) / history / Publish-with-text. `inline-flex` purged (Lynx drops it → children stacked vertically). |
| Editor mosaic | ✓ | Upstream `createMosaic` verbatim (KNOWN_FILES sort → half-split, top row / nested columns, 50/50, rebuild-on-visibility-change via keyed remount). One live `<scintilla-view>` per visible file (`fiddle:<file>` ids — registry supports N instances). 30px pane toolbars (exact upstream title strings), maximize=70% expand, cross=hide. Sidebar Editors section with eye toggles; zero-state NonIdealState. |
| Fiddle highlight loop | ✓ | 100ms poll over visible panes: hasContentChanged → getText → state + 150ms-debounced computeStyles/setStyles. (App.tsx's legacy loop never serviced fiddle editors.) |
| Native-view repaint fix | ✓ | Content pushed before first attach doesn't repaint — EditorPane re-pushes +150ms after body's first layoutchange. |
| Dialog z-order | ✓ | Native editors float above Lynx UI: any open dialog detaches all visible editors, re-push on close. |
| file:// resources | ✓ | main.ts replaces the http-only `-on-fetch-resource` listener with one serving file:// from disk. |
| Dev harness | ✓ | `dev-preset.ts`: tour suppression + `openSurface` boot preset + periodic real-window capture. Real-window verify: `screencapture -x -l <CGWindowID>` (devtool can't see native views). |
| Dialog body collapse / tour footer / StatusBar | ✓ | Lynx flex-basis-0-in-auto-height fix; footer via Dialog prop; bottom StatusBar removed (upstream has none). |

| Fiddle app menu | ✓ | main.ts menu mirrors upstream (File: New Fiddle ⌘N / Open… ⌘O / Save ⌘S / Publish; View: Toggle Console ⌘J / Reset Layout; Tasks: Run ⌘R / Stop ⇧⌘R; Help: Tour/repo/About) via `fiddle:*` global events. Old IDE menu gone. |
| File → Open… | ✓ | `runner/open.ts` loads a saved fiddle folder back (fixed set + extra editor files) — closes the local-fiddle-workspace gap. |
| Sidebar file management | ✓ | '+' → FileNameDialog (upstream ext validation); hover rename/delete per row (right-click doesn't exist in Lynx); main.js/package.json protected. |
| Modules npm search | ✓ | registry.npmjs.org search, debounced; click-to-add ^version into package.json deps; installed list with remove. |
| Sole-main-page routing | ✓ verified | App.tsx renders `<Fiddle/>` unless the Gallery overlay is open; no `<IDE>` mount exists (only RouteNavigationControls import remains). |

| Session persistence | ✓ verified | fiddle.lastSession: periodic change-detected writes; boot restore. E2E-proven (disk mutation restored on restart). Unit tests for round-trip/corruption. |
| foundation bridge fix | ✓ | exposed.foundation never existed post-refactor — 22 silent no-op call sites (Save/Run/Settings/versions) migrated to store.foundationApi(). |
| Console collapse / picker body / hover hit-region | ✓ verified | collapseTarget='first'; TemplatePicker flex collapse fixed (all 9 showcase templates render + Blank click loads); hover actions display:none (opacity:0 kept hit region). |

| Showcase open-and-run in Fiddle | ✓ verified (real machine) | TemplatePicker showcase click → resolveShowcaseWorkspace (registry path / showcaseApi.fetch download) → source files load into the mosaic (runner/showcase-open.ts) → Run writes edits back and executes (isBuilt→run, else install+dev with console streaming) → Stop kills the tree. Verified with counter via computer-use. Modules sidebar reflects the showcase's package.json. |
| Workspace pkg builds | fixed | @lynxtron-showcases/cli (fetch path) and /config (showcase dev) shipped no dist after pnpm install — both failed silently. `pnpm build` in packages/{cli,config} required per fresh worktree. |

| lynxtron-go self-host run | ✓ verified (real machine) | TemplatePicker → lynxtron-go card → source into mosaic (Modules=7 from its package.json) → Run: isBuilt→showcase.run spawns `lynxtron <worktree>/lynxtron-go/dist/desktop` as a child process with its own window (a second Fiddle instance — self-hosting works). Stop kills it. |
| Dev command file | landed (289f7f1) | `DEV_PRESET.commandFile=/tmp/fable5-cmd`: Fiddle drains the file every 500ms and dispatches lines (`fiddle:run`, `fiddle:stop`, `fiddle:openFolder {"path":...}`) through the same handler table as app-menu events. Shell automation drives the app without mouse/keyboard/CDP — needed because keystrokes go to whichever same-bundleId instance is frontmost (a parallel agent's window stole ⌘R mid-verification), and devtool CDP only becomes responsive minutes after boot. |

| Editor perf + parity round (goal-3) | ✓ verified | Keystrokes no longer setState (liveText ref; dirty-flag flips only; persist folds live text statelessly); resetLayout = load-time important files (meta/config excluded, cap 4); sash moves throttled + buttons==0 release fallback; highlight double-push after overlay close. |
| hiddenInset titlebar | ✓ verified | titleBarStyle hiddenInset + trafficLightPosition(20,17); commands header pads 74px on mac (upstream windows.ts parity). |
| Dark/Light theming | ✓ verified | Upstream token sets as CSS vars on .IDE/.IDE.theme-light (Lynx var() support probed); native setEditorTheme(id,dark,sizePt) themes Scintilla (VS Dark+/VS Light palettes); Settings applies live; font size immediate. fiddle:setTheme drives headlessly. |

**Session 2 gaps / follow-ups:**
- Outputs stops draining readProcessOutput once the runner pid dies — a failing child's final stderr lines never reach the console (root-cause of a silent dev failure during verification; drain-once-after-exit needed).
- ~~Showcase dev script didn't surface the app window~~ — **root-caused & fixed (5b80b0a), verified**: counter's `dev` = `concurrently "rspeedy dev" "dev-ready-rspeedy && rspack dev"`; the window comes from step 2, but `dev-ready-rspeedy` waits on port 3000 — taken by another agent's dev server, so rspeedy rebinds to 3003 and the gate hangs forever (Run looked alive, no window). Fiddle Run now prefers the showcase's `start` script (`build && lynxtron ./dist/desktop` — window guaranteed, matches Electron Fiddle's Run semantics); `dev` stays as fallback when no start script exists. Companion fix: spawns are `detached:true` and `stop()` kills the process group — SIGTERM to the direct child alone orphaned the `sh -c "build && launch"` chain (Counter window survived Stop). Trade-off noted: detached children survive an app crash (no reaper on quit).
- ~~Gallery is one-way~~ / ~~Gallery "Open" is a dead end~~ — **fixed (aae5a11), verified on real machine**: GalleryHome gained "← Back to Fiddle"; card actions are now Open (hands entry to Fiddle via `pendingShowcaseTemplate` → same download→mosaic chain as TemplatePicker) / Run / **IDE** (legacy chain: `openShowcaseEntry` + mounts the old IDE shell — `legacyIdeOpen && route.kind==='workspace'` branch in mainContent). Route chevrons navigate Fiddle ↔ legacy IDE both ways. QuickPicker showcase select also routes into the Fiddle now. Remaining: deep-link `open-showcase` still uses the legacy chain without mounting the IDE (loads route state invisibly) — decide whether deep links should target Fiddle or legacy IDE.
- ~~Both Fiddle instances share the session config store~~ — **fixed (571a6e9), verified**: the config file was a GLOBAL `~/.lynxtron-ide.json` shared by every worktree build on the machine (parallel agents' instances polluted each other's sessions — the real source of mystery restores). Now namespaced per checkout (`~/.lynxtron-ide.<sha1(__dirname)[:8]>.json`); same-worktree self-host children arbitrate via a `fiddle.session.writer` heartbeat lease (child verified read-only while parent alive). Self-host children spawn with `LYNXTRON_FIDDLE_SELF_HOST=1` → window title badge "· self-host" + singleton lock waived. Gallery is now an overlay above the still-mounted Fiddle (native buffers survive; new scintilla `attachToWindow` API re-attaches detached editors — OnLayoutChanged's lazy attach never fires when an absolute overlay closes). DEV_PRESET capture/command paths still shared between same-worktree instances (dev-only).

1. Scintilla theme is VS Code Dark+ (#1E1E1E) not Fiddle Dark (#2f3241) — colors are compile-time constants in scintilla_view.mm + scintilla_view_win.cc; patch + cmake-js rebuild (both platforms) required.
2. Sash drag between two native panes unverified (mouse events over floating NSViews may not reach Lynx — may need detach-during-drag).
3. Drag-to-rearrange panes (upstream toolbar drag) not ported (upstream rebuilds layout on visibility change anyway).
4. Sidebar add-file / rename / delete context menu; focused-file ring; pane severity colors.
5. Fiddle-shaped app menu (File/Tasks/View) — native menu is still the old IDE's.
6. Fresh worktrees need `lynx_scintilla_module.node` copied/built (cmake-js artifact, not in git) — else "ScintillaEditor extension skipped".
7. Pre-existing env-dependent test failure: `formatNodeVersionRequirementError` embeds system Node version (fails on session-1 tree too).

---

## File Structure (Phase 1)

**New files (Phase 1):**
```
lynxtron-go/src/app/fiddle/
  Fiddle.tsx                 # Top-level Fiddle shell (replaces IDE routing target)
  Fiddle.css                 # Root layout CSS
  Header/
    Header.tsx               # Wraps Commands
    Header.css
    Commands.tsx             # Command bar layout (settings/version/run/console/address)
    Commands.css
  Editors/
    Editors.tsx              # Multi-file editor mosaic (Scintilla panes)
    Editors.css
    EditorTab.tsx            # Single editor pane with file id label
  Sidebar/
    FiddleSidebar.tsx        # Fiddle sidebar: file list + open/new/etc. (thin at first)
    FiddleSidebar.css
  Outputs/
    Outputs.tsx              # Console output panel (empty state in P1)
    Outputs.css
  types.ts                   # EditorId enum + shared types
lynxtron-go/src/app/fiddle/README.md   # Notes for future maintainers
```

**Modified files (Phase 1):**
```
lynxtron-go/src/app/App.tsx           # Route to <Fiddle /> instead of GalleryHome on boot
lynxtron-go/src/app/App.css           # Import fiddle css
lynxtron-go/lynx.config.ts            # Add dev server port 5817
```

**Untouched in Phase 1 (deliberately):**
```
lynxtron-go/src/app/components/Gallery/     # kept in tree, re-linked in P4
lynxtron-go/src/app/components/IDE/         # kept in tree, deleted in P5 once Runner is proven
```

---

## Phase 1 — Visual Shell

**Goal:** Boot the app and see a Fiddle-shaped page with header, sidebar, editor mosaic, and console pane. Editors are wired to existing Scintilla so real text renders. Buttons in the header exist visually but are inert (log a TODO on tap). Nothing else changes.

**Non-goals in Phase 1:** Runner, version chooser, gist loader, settings, MobX state, templates, showcase downloader. Those are Phases 3–8.

### Task P1-1: Set the dev port to 5817

**Files:**
- Modify: `lynxtron-go/lynx.config.ts` (append to `defineConfig` object at ~line 93)

- [ ] **Step 1: Read current config**

Run: `sed -n '85,115p' lynxtron-go/lynx.config.ts` to locate the `defineConfig({...})` block.

- [ ] **Step 2: Add `server.port` under `dev`**

Add (or extend) inside the `defineConfig({...})` argument:

```ts
server: {
  port: 5817,
},
```

If a `server` key already exists, add the `port` field to it.

- [ ] **Step 3: Verify config loads**

Run: `cd lynxtron-go && pnpm rspeedy --version`
Expected: prints a version, no config error.

- [ ] **Step 4: Commit**

```bash
git add lynxtron-go/lynx.config.ts
git commit -m "chore(lynxtron-go): pin lynx dev server to port 5817 for fiddle port"
```

### Task P1-2: Scaffold the fiddle module

**Files:**
- Create: `lynxtron-go/src/app/fiddle/types.ts`
- Create: `lynxtron-go/src/app/fiddle/Fiddle.tsx`
- Create: `lynxtron-go/src/app/fiddle/Fiddle.css`
- Create: `lynxtron-go/src/app/fiddle/README.md`

- [ ] **Step 1: Write `types.ts`**

```ts
// lynxtron-go/src/app/fiddle/types.ts
// Editor IDs — mirrors Fiddle's fixed set. Additional user-added files land under `custom:<name>`.
export const DEFAULT_EDITORS = {
  MAIN: 'main.js',
  RENDERER: 'renderer.js',
  PRELOAD: 'preload.js',
  HTML: 'index.html', // treated as Lynx entry markup placeholder in Lynxtron mode
  CSS: 'styles.css',
  PACKAGE: 'package.json',
} as const;

export type EditorId = string;

export interface FiddleFile {
  id: EditorId;
  content: string;
  language: 'javascript' | 'typescript' | 'html' | 'css' | 'json' | 'text';
}
```

- [ ] **Step 2: Write `Fiddle.tsx` (visual shell only)**

```tsx
// lynxtron-go/src/app/fiddle/Fiddle.tsx
import { useState } from '@lynx-js/react';
import { SplitContainer } from '../components/Layout/SplitContainer';
import { Header } from './Header/Header';
import { FiddleSidebar } from './Sidebar/FiddleSidebar';
import { Editors } from './Editors/Editors';
import { Outputs } from './Outputs/Outputs';
import './Fiddle.css';

export interface FiddleProps {
  rootPath: string | null;
  onOpenGallery: () => void;
}

export function Fiddle(props: FiddleProps) {
  const [isConsoleShowing, setConsoleShowing] = useState(true);
  const [outputsRatio, setOutputsRatio] = useState(0.25);
  const [sidebarRatio, setSidebarRatio] = useState(0.18);

  return (
    <view className="Fiddle">
      <Header
        onToggleConsole={() => setConsoleShowing(v => !v)}
        onOpenGallery={props.onOpenGallery}
        isConsoleShowing={isConsoleShowing}
      />
      <view className="FiddleBody">
        <SplitContainer
          direction="vertical"
          initialRatio={outputsRatio}
          minSizePx={80}
          collapsed={!isConsoleShowing}
          onRatioChange={setOutputsRatio}
        >
          <Outputs />
          <SplitContainer
            direction="horizontal"
            initialRatio={sidebarRatio}
            minSizePx={140}
            onRatioChange={setSidebarRatio}
          >
            <FiddleSidebar rootPath={props.rootPath} />
            <Editors />
          </SplitContainer>
        </SplitContainer>
      </view>
    </view>
  );
}
```

- [ ] **Step 3: Write `Fiddle.css`**

```css
/* lynxtron-go/src/app/fiddle/Fiddle.css */
.Fiddle {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  color: #cccccc;
}
.FiddleBody {
  flex: 1;
  min-height: 0;
  display: flex;
  width: 100%;
}
```

- [ ] **Step 4: Write `README.md`**

```md
# Fiddle module

Fiddle-shaped shell that replaces the folder-based IDE as the default landing.
Phased port; see docs/superpowers/plans/2026-07-01-lynxtron-fiddle-port.md.
Sub-directories mirror Fiddle's renderer components:
- Header/     → src/renderer/components/{header,commands}.tsx
- Editors/    → src/renderer/components/{editors,editor,output-editors-wrapper}.tsx
- Sidebar/    → src/renderer/components/{sidebar,sidebar-file-tree}.tsx
- Outputs/    → src/renderer/components/{output,outputs}.tsx
```

- [ ] **Step 5: Commit**

```bash
git add lynxtron-go/src/app/fiddle/
git commit -m "feat(fiddle): scaffold Fiddle shell module (P1-2)"
```

### Task P1-3: Header + inert Commands bar

**Files:**
- Create: `lynxtron-go/src/app/fiddle/Header/Header.tsx`
- Create: `lynxtron-go/src/app/fiddle/Header/Header.css`
- Create: `lynxtron-go/src/app/fiddle/Header/Commands.tsx`
- Create: `lynxtron-go/src/app/fiddle/Header/Commands.css`

- [ ] **Step 1: Write `Header.tsx`**

```tsx
// lynxtron-go/src/app/fiddle/Header/Header.tsx
import { Commands } from './Commands';
import './Header.css';

export interface HeaderProps {
  isConsoleShowing: boolean;
  onToggleConsole: () => void;
  onOpenGallery: () => void;
}

export function Header(props: HeaderProps) {
  return (
    <view className="FiddleHeader">
      <Commands
        isConsoleShowing={props.isConsoleShowing}
        onToggleConsole={props.onToggleConsole}
        onOpenGallery={props.onOpenGallery}
      />
    </view>
  );
}
```

- [ ] **Step 2: Write `Header.css`**

```css
.FiddleHeader {
  height: 44px;
  min-height: 44px;
  background-color: #2d2d2d;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  align-items: center;
  padding: 0 8px;
}
```

- [ ] **Step 3: Write `Commands.tsx` (inert visual buttons)**

```tsx
// lynxtron-go/src/app/fiddle/Header/Commands.tsx
import './Commands.css';

export interface CommandsProps {
  isConsoleShowing: boolean;
  onToggleConsole: () => void;
  onOpenGallery: () => void;
}

export function Commands(props: CommandsProps) {
  return (
    <view className="commands">
      <view className="cmd-group">
        <view className="cmd-btn" bindtap={() => { /* TODO settings dialog */ }}>
          <text className="cmd-icon">⚙</text>
        </view>
      </view>
      <view className="cmd-group">
        <view className="cmd-btn cmd-btn--select" bindtap={() => { /* TODO version chooser */ }}>
          <text className="cmd-btn-text">Lynxtron 0.0.0</text>
          <text className="cmd-icon">▾</text>
        </view>
        <view className="cmd-btn cmd-btn--primary" bindtap={() => { /* TODO runner */ }}>
          <text className="cmd-icon">▶</text>
          <text className="cmd-btn-text">Run</text>
        </view>
      </view>
      <view className="cmd-group">
        <view
          className={'cmd-btn' + (props.isConsoleShowing ? ' cmd-btn--active' : '')}
          bindtap={props.onToggleConsole}
        >
          <text className="cmd-icon">▤</text>
          <text className="cmd-btn-text">Console</text>
        </view>
      </view>
      <view className="cmd-spacer" />
      <view className="cmd-group">
        <view className="cmd-address-bar" bindtap={() => { /* TODO gist load */ }}>
          <text className="cmd-address-placeholder">gist url…</text>
        </view>
        <view className="cmd-btn" bindtap={props.onOpenGallery}>
          <text className="cmd-btn-text">Browse showcases</text>
        </view>
      </view>
    </view>
  );
}
```

- [ ] **Step 4: Write `Commands.css`**

```css
.commands {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
}
.cmd-group { display: flex; align-items: center; gap: 4px; }
.cmd-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  height: 28px;
  border-radius: 3px;
  background-color: #3a3a3a;
}
.cmd-btn--active { background-color: #094771; }
.cmd-btn--primary { background-color: #0e639c; }
.cmd-btn--primary .cmd-btn-text { color: #ffffff; }
.cmd-btn-text { font-size: 12px; color: #cccccc; }
.cmd-icon { font-size: 14px; color: #cccccc; }
.cmd-spacer { flex: 1; }
.cmd-address-bar {
  height: 28px;
  min-width: 220px;
  padding: 0 10px;
  background-color: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
  display: flex;
  align-items: center;
}
.cmd-address-placeholder { color: #7a7a7a; font-size: 12px; }
```

- [ ] **Step 5: Commit**

```bash
git add lynxtron-go/src/app/fiddle/Header/
git commit -m "feat(fiddle): header with inert commands bar (P1-3)"
```

### Task P1-4: Sidebar + Outputs (stubs)

**Files:**
- Create: `lynxtron-go/src/app/fiddle/Sidebar/FiddleSidebar.tsx`
- Create: `lynxtron-go/src/app/fiddle/Sidebar/FiddleSidebar.css`
- Create: `lynxtron-go/src/app/fiddle/Outputs/Outputs.tsx`
- Create: `lynxtron-go/src/app/fiddle/Outputs/Outputs.css`

- [ ] **Step 1: Write `FiddleSidebar.tsx` (list Fiddle's fixed editor set)**

```tsx
// lynxtron-go/src/app/fiddle/Sidebar/FiddleSidebar.tsx
import { DEFAULT_EDITORS } from '../types';
import './FiddleSidebar.css';

export interface FiddleSidebarProps {
  rootPath: string | null;
}

const FIDDLE_FILES: string[] = Object.values(DEFAULT_EDITORS);

export function FiddleSidebar(_props: FiddleSidebarProps) {
  return (
    <view className="FiddleSidebar">
      <view className="FiddleSidebar-Header">
        <text className="FiddleSidebar-Title">FIDDLE</text>
      </view>
      <scroll-view className="FiddleSidebar-List" scroll-orientation="vertical">
        {FIDDLE_FILES.map(name => (
          <view key={name} className="FiddleSidebar-Item">
            <text className="FiddleSidebar-ItemText">{name}</text>
          </view>
        ))}
      </scroll-view>
    </view>
  );
}
```

- [ ] **Step 2: Write `FiddleSidebar.css`**

```css
.FiddleSidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #252526;
  border-right: 1px solid #1a1a1a;
}
.FiddleSidebar-Header {
  height: 28px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1a1a1a;
}
.FiddleSidebar-Title { font-size: 11px; color: #888888; letter-spacing: 0.5px; }
.FiddleSidebar-List { flex: 1; min-height: 0; }
.FiddleSidebar-Item { padding: 4px 12px; }
.FiddleSidebar-ItemText { font-size: 13px; color: #cccccc; }
```

- [ ] **Step 3: Write `Outputs.tsx` (empty state)**

```tsx
// lynxtron-go/src/app/fiddle/Outputs/Outputs.tsx
import './Outputs.css';

export function Outputs() {
  return (
    <view className="Outputs">
      <view className="Outputs-Header">
        <text className="Outputs-Title">Console</text>
      </view>
      <view className="Outputs-Body">
        <text className="Outputs-Empty">Run a Fiddle to see console output.</text>
      </view>
    </view>
  );
}
```

- [ ] **Step 4: Write `Outputs.css`**

```css
.Outputs {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  border-bottom: 1px solid #1a1a1a;
}
.Outputs-Header {
  height: 24px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  background-color: #2d2d2d;
  border-bottom: 1px solid #1a1a1a;
}
.Outputs-Title { font-size: 11px; color: #cccccc; letter-spacing: 0.5px; }
.Outputs-Body { flex: 1; min-height: 0; padding: 8px 12px; }
.Outputs-Empty { color: #7a7a7a; font-size: 12px; }
```

- [ ] **Step 5: Commit**

```bash
git add lynxtron-go/src/app/fiddle/Sidebar/ lynxtron-go/src/app/fiddle/Outputs/
git commit -m "feat(fiddle): sidebar + outputs shell (P1-4)"
```

### Task P1-5: Editors area with existing Scintilla

**Files:**
- Create: `lynxtron-go/src/app/fiddle/Editors/Editors.tsx`
- Create: `lynxtron-go/src/app/fiddle/Editors/Editors.css`

**Reuse:** Existing `EditorPanel` (Scintilla) at `lynxtron-go/src/app/components/Editor/EditorPanel.tsx` and existing `TabBar` at `lynxtron-go/src/app/components/TabBar/TabBar.tsx`.

- [ ] **Step 1: Read the reused surfaces so we call them correctly**

Run:
```
sed -n '1,80p' lynxtron-go/src/app/components/Editor/EditorPanel.tsx
sed -n '1,80p' lynxtron-go/src/app/components/TabBar/TabBar.tsx
```

Take note of the exact prop names. If they don't map cleanly, the Editors component in P3 will replace them with a MobX-driven version.

- [ ] **Step 2: Write `Editors.tsx` — Phase-1 minimum: static empty tabs + one Scintilla pane**

```tsx
// lynxtron-go/src/app/fiddle/Editors/Editors.tsx
import { useState } from '@lynx-js/react';
import { TabBar } from '../../components/TabBar/TabBar';
import { EditorPanel } from '../../components/Editor/EditorPanel';
import { DEFAULT_EDITORS } from '../types';
import './Editors.css';

const STARTER_TABS = [
  { id: DEFAULT_EDITORS.MAIN, label: DEFAULT_EDITORS.MAIN, fullPath: DEFAULT_EDITORS.MAIN, dirty: false },
  { id: DEFAULT_EDITORS.RENDERER, label: DEFAULT_EDITORS.RENDERER, fullPath: DEFAULT_EDITORS.RENDERER, dirty: false },
  { id: DEFAULT_EDITORS.PRELOAD, label: DEFAULT_EDITORS.PRELOAD, fullPath: DEFAULT_EDITORS.PRELOAD, dirty: false },
  { id: DEFAULT_EDITORS.HTML, label: DEFAULT_EDITORS.HTML, fullPath: DEFAULT_EDITORS.HTML, dirty: false },
];

export function Editors() {
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_EDITORS.MAIN);

  return (
    <view className="FiddleEditors">
      <TabBar
        tabs={STARTER_TABS as any}
        activeTabId={activeTabId}
        onSwitchTab={setActiveTabId}
        onCloseTab={() => { /* Phase 3 wires this to state */ }}
      />
      <view className="FiddleEditors-Body">
        <EditorPanel activeTabId={activeTabId} />
      </view>
    </view>
  );
}
```

If `TabBar`'s tab type doesn't match, either widen the local type or add an adapter — do NOT edit `TabBar` in Phase 1. If `EditorPanel` requires additional props beyond `activeTabId`, thread them through from Phase-1 stubs (record the exact required set in the commit message).

- [ ] **Step 3: Write `Editors.css`**

```css
.FiddleEditors {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
}
.FiddleEditors-Body {
  flex: 1;
  min-height: 0;
  display: flex;
}
```

- [ ] **Step 4: Commit**

```bash
git add lynxtron-go/src/app/fiddle/Editors/
git commit -m "feat(fiddle): editors area reusing existing Scintilla panel (P1-5)"
```

### Task P1-6: Route App.tsx to `<Fiddle />` on boot

**Files:**
- Modify: `lynxtron-go/src/app/App.tsx` — inside the `App` function, at the top-level route decision, render `<Fiddle />` as the default instead of `<GalleryHome />`. Keep an `onOpenGallery` prop that flips a local `isGalleryOpen` state so a modal can render Gallery in P4 (Phase 1 wiring only — Gallery UI stays reachable but the button is inert if there's no route yet, in which case leave the state and simply toggle it).

- [ ] **Step 1: Read the current route branch**

Run: `grep -n "GalleryHome\|IDE" lynxtron-go/src/app/App.tsx | head -40` to find every place `GalleryHome` and `IDE` are rendered.

- [ ] **Step 2: Add Fiddle import and a top-of-App state flag**

Near the other component imports (around line 60):
```tsx
import { Fiddle } from './fiddle/Fiddle';
```

Inside `App()`, near the other `useState` hooks:
```tsx
const [isGalleryOpen, setGalleryOpen] = useState(false);
```

- [ ] **Step 3: Change the boot route**

Locate the branch that currently returns `<GalleryHome ... />` at app startup and swap the render target so that when there is no active workspace / no current fiddle, we render `<Fiddle rootPath={null} onOpenGallery={() => setGalleryOpen(true)} />`. Keep the `<IDE ... />` branch renderable behind a debug flag for Phase 1 (so we can eyeball regressions); do not delete IDE routing until P5.

If Gallery-open is truthy, render the existing `<GalleryHome />` as a full-screen overlay above `<Fiddle />` (position: absolute in App.css). This preserves the escape hatch for browsing showcases while Fiddle is the landing.

Exact edit: describe the diff in the commit message. If the route decision is spread across multiple branches, add a single `if (isGalleryOpen) return <GalleryOverlay>...</GalleryOverlay>` early return under `App()`.

- [ ] **Step 4: Wire App.css to import Fiddle.css transitively (no direct import needed if `Fiddle.tsx` imports its own CSS — verify)**

Run: `grep -n "Fiddle.css" lynxtron-go/src/app/fiddle/Fiddle.tsx`
Expected: hits — confirms the CSS import is present.

- [ ] **Step 5: Dev-run and eyeball**

Run: `cd lynxtron-go && pnpm dev` in one terminal.
Expected: Rspeedy prints `http://localhost:5817`, Rspack builds the desktop main process, `lynxtron` launches. The window should show the Fiddle header + sidebar + editors + console pane instead of GalleryHome. Buttons in the header log nothing (they're inert), console pane shows "Run a Fiddle to see console output."

If the window still shows GalleryHome, the route branch was missed. Grep for `GalleryHome` in `App.tsx` again and confirm the boot branch was changed.

- [ ] **Step 6: Commit**

```bash
git add lynxtron-go/src/app/App.tsx
git commit -m "feat(fiddle): route App to Fiddle shell on boot, GalleryHome as overlay (P1-6)"
```

### Task P1-7: Screenshot vs. Fiddle reference

**Files:** (no code changes — verification only)

- [ ] **Step 1: Take a screenshot of the running Lynxtron GO window and save under `docs/superpowers/plans/screenshots/2026-07-01-P1-fiddle-shell.png`.**

- [ ] **Step 2: Open the Fiddle reference at https://www.electronjs.org/fiddle in a browser, take a screenshot for side-by-side comparison, save as `docs/superpowers/plans/screenshots/2026-07-01-P1-fiddle-reference.png`.**

- [ ] **Step 3: Note the biggest visual gaps in `docs/superpowers/plans/2026-07-01-P1-visual-diff.md` — this feeds Phase 2 (BP UI kit) priorities.**

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/screenshots/ docs/superpowers/plans/2026-07-01-P1-visual-diff.md
git commit -m "docs(fiddle): P1 visual diff vs. upstream Fiddle"
```

---

## Verification (end of Phase 1)

Per your engineering principle #4 (compile passing ≠ works), verify end-to-end:

1. `cd lynxtron-go && pnpm build` — must succeed.
2. `cd lynxtron-go && pnpm start` — launches the Lynxtron process against the built bundle. Window must show the Fiddle shell, not GalleryHome.
3. Header buttons render but are inert (no crash on tap).
4. Sidebar shows the fixed file list (`main.js`, `renderer.js`, `preload.js`, `index.html`, `styles.css`, `package.json`).
5. Editors area shows a TabBar and one Scintilla editor pane.
6. Outputs pane shows the empty-state text.
7. Splitters between panes drag and resize (SplitContainer functionality).
8. No console errors in the Lynx DevTool (use the `lynx-devtool` skill to attach).

If any check fails, do NOT proceed to Phase 2. Follow principle #3: for any error, `git stash` back to pre-P1 and confirm the error is new — then debug it as a real bug, not "pre-existing."

---

## Follow-up Phases (outline only — detailed plans written on kick-off)

- **Phase 2 (BP UI kit):** enumerate every `@blueprintjs/core` component Fiddle actually imports (`Button`, `ControlGroup`, `Icon`, `Dialog`, `MenuItem`, `Select`, `InputGroup`, `Callout`, `Alert`, `Popover`, `Spinner`). Build minimal ReactLynx equivalents under `components/BP/` with matching prop shapes and class names. Port Fiddle's `blueprint.less` and `variables.less` for tokens.
- **Phase 3 (Fiddle state):** copy `AppState`, `EditorMosaic`, `FileManager` files into `fiddle/state/`; adjust `require('electron').ipcRenderer` calls to the Lynxtron preload API surface; MobX runs unchanged.
- **Phase 4 (Templates + Gallery integration):** add `TemplatePicker.tsx`; wire `@lynxtron-showcases/cli` install into a temp fiddle workspace directory (config-store key `fiddle.workspaceRoot`); Gallery becomes a route inside the picker.
- **Phase 5 (Runner + Console):** port `runner.ts`; replace `@electron/fiddle-core` with Lynxtron runtime spawn (see `~/github/lynxtron/lynxtron_tools` for the CLI); pipe stdout/stderr through the preload bridge; render into `Outputs`.
- **Phase 6 (Version chooser):** add Lynxtron runtime versions to the config store; download via `@lynx-js/lynxtron` catalog resolver; persist per-fiddle.
- **Phase 7 (Gist loader):** port `remote-loader.ts` + `AddressBar` + `GistActionButton`; auth via existing GitHub flow if present.
- **Phase 8 (Settings pane):** port `settings-*.tsx`; wire to preload config store.
- **Phase 9 (Polish):** dialogs, tour, icon audit, final CSS parity pass.

---

## Notes on binary deps (from user)

`tosv.byted.org` is region-routed and blocks overseas — if any Lynxtron runtime download uses that domain, swap to `cdn-tos-cn.bytedance.net`. Document in Phase 6 kickoff.
