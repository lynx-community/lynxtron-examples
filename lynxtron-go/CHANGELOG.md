# lynxtron-go

## 0.1.1

### Patch Changes

- 6c24c4c: Give the commands bar room to breathe, and the palette a way to be found.

  - **The palette has a visible entry point.** ⌘P and ⌘K existed only as menu
    accelerators, so the feature was invisible unless you already knew it was
    there. A search button now sits beside Gallery — its sibling, one browsing by
    eye and the other by typing — and the accelerator _is_ its label, rendered as
    data rather than prose.

  - **Five right-hand buttons became two.** New Fiddle, Save, Gist History and
    Help moved into an overflow; all four already carry accelerators, and spending
    bar width on them squeezed the gist address into a field too narrow to read a
    URL in. Publish stays, because publishing has no key.

    The overflow is owned by the Fiddle shell rather than the bar: the 51px header
    clips its own children, so a menu anchored inside it can never open, and
    native editor views paint above all Lynx UI regardless of z-index — it joins
    the dialogs that already suppress the editors while open.

  - **The gist field no longer resizes while you type.** It animated between two
    widths depending on whether it had content, so the field grew out from under
    the caret at the first keystroke. Fixed at 280px.

  - **Accelerators look like accelerators.** Every shortcut shown in the UI — the
    palette button, every overflow item — now uses one key-cap treatment: 10px
    mono on a tinted ground, quiet by default and brought to full contrast on
    hover. Previously the palette hint was plain text large enough to compete with
    the label beside it.

  - **Menu item text was invisible.** `.bp3-menu-item-text` carried `flex: 1`,
    whose zero basis collapses a `<text>` to zero width in a row: Lynx has no
    `min-content` and its shrink floor is `0px`, so nothing holds the text open
    the way `min-width: auto` does on the web. It grows with `flex-grow` and an
    `auto` basis instead. The Menu primitive had never been rendered before this
    change, so nothing had exercised it.

  - **Editor panes read as objects.** Each pane closes with a hairline instead of
    relying on gutter gaps alone, and the focused one states itself structurally —
    brighter edge, lifted toolbar — rather than by tinting its title. The toolbar
    drops from 30px to 28px, loses the doubled separator (a top border _and_ a
    drop shadow, for one edge that the gutter already draws) in favour of a single
    rule under the label, and sets the file path in monospace at 12px so chrome
    sits below the code it names. The control cluster is no longer
    `transform: scale(0.75)` — scaling shrank the hit targets and knocked the
    glyphs off the baseline; the buttons are simply sized small.

  - **The bar has tooltips, and Console has dropped its label.** Lynx draws no
    tooltip and `title` is inert here — the only "tooltip" in the Lynxtron API is
    a vibrancy material name — so every `title` in this bar promised an
    affordance that did not exist, and no control could shed its word. A bar
    tooltip was blocked twice over: the header clips its children, and the native
    editor painted above all Lynx UI. Both are gone, so the bubble now renders
    through the shared platform overlay host, positioned from the anchor's
    measured rect. Console, whose label only repeated a panel already on screen,
    is now an icon.

  - **The version button wears the Lynxtron mark** instead of `saved`, a tick
    that said "saved" — something that button has never meant. Two lockups ship,
    because the mark is a near-black disc that reads as a hole on the dark bar,
    and Lynx's `filter` has no `invert` to derive one at runtime.

  - **The gallery's Electron Fiddles collection has a card.** All 55 sat below
    ten full-bleed cards, past two screens, with nothing on the first screen
    saying they existed. The collection now takes the first grid slot; its one
    action is Browse, because opening or running "all 55 fiddles" is exactly the
    confusion the collection was split up to avoid.

  - **The bar is one filled control and a row of glyphs.** Run wears the Lynxtron
    mark instead of a play triangle — this builds a project and starts a runtime,
    and the mark says which one — and it is the only shape in the chrome. The
    version chooser drops the mark it used to carry (two marks competing in one
    glance, on the quietest control in the bar) and is now text with a chevron.
    Search moves to the left, where you look for it, and is shaped like the field
    it opens rather than a button. Console, Gallery, Load, Publish, Settings and
    the overflow are icons; the tooltips carry their names. A hairline separates
    the gist field from the app rail, because two cloud arrows either side of
    nothing read as one set of four.

  - **Panels sit on the ground instead of being carved out of it.** 6px corners
    on the sidebar, the console and every editor pane, with real space around
    them — a radius is invisible if the panel is flush to its neighbours, so the
    seam widened to 6px and the whole group is inset from the window edge.

  - **The overflow menu can be dismissed again.** Its backdrop was
    `position: fixed`, and Lynx promotes a fixed node directly under the root —
    which lifted the dismiss surface straight out of the platform overlay it was
    rendered into, behind an overlay that was already swallowing every tap meant
    for it. Absolute keeps it inside; the geometry is identical.

- f0b369d: Three fixes found while testing the IDE surface.

  **The palette opened behind the code.** Native Scintilla views paint above all
  Lynx UI whatever the z-index says, so an overlay does not cover the editor — the
  editor covers the overlay. The palette, gallery, dialogs, loading state, and
  toasts now register with one shared `cover-view` host, which composites their
  children into a platform overlay slice above native views without creating a
  second macOS overlay surface during rapid modal transitions. The Scintilla extension now keeps the
  originating `lynx_view_t`, mounts its NSView/HWND under that view's native
  parent, and keeps the editor below Clay's overlay host instead of guessing the
  key window and floating above the entire Lynx surface. Editors stay attached
  while overlays are open, preserving focus, selection, scroll position, and
  paint state.

  **One resolver, and reuse what is already on disk.** The Fiddle and the IDE are
  two views of one workspace, but each carried its own copy of "local source tree,
  else fetch" — two functions meaning the same thing, free to drift, sharing every
  failure anyway. They now share one, which also gained the step both were
  missing: `fetch` wipes and re-extracts its destination on every call, so opening
  a showcase in the Fiddle and then in the IDE downloaded and installed the same
  workspace twice, seconds apart. A materialized workspace is now reused, verified
  by reading its manifest so a half-extracted directory from an interrupted fetch
  is not mistaken for a usable one.

  **A failed workspace says so.** A window opened to prepare a showcase that never
  arrived showed the same "Open Folder" invitation as an idle one; the reason sat
  in the Output panel, which is closed by default. The editor area now names the
  failure and offers Try again.

## 0.1.0

### Minor Changes

- dd950b6: Add the `electron-fiddles` showcase — the complete Electron `docs/fiddles` set
  ported to Lynxtron (55 fiddles: 37 working, 7 partial, 11 N/A) — and surface it
  as a dedicated "Electron Fiddles" section in the Lynxtron GO gallery.

  It follows upstream's own model rather than inventing one. Upstream's
  `docs/fiddles` holds 171 files and zero `package.json`s: each fiddle is a plain
  source folder, and Electron Fiddle synthesizes a throwaway project around it at
  run time and spawns Electron on that. Here each fiddle is likewise a loose
  source folder laid out at its upstream path, and `scripts/assemble.mjs` turns one
  into a complete standalone Lynxtron project, compiles it, and runs it — with the
  one extra step Electron does not need, since Lynx cannot load source at run time.

  Because every fiddle is its own project, launching one from the gallery spawns
  its own Lynxtron process. That isolation is load-bearing: while all fiddles
  shared a single main process, the ones touching app-global state
  (`Menu.setApplicationMenu`, `app.dock.setMenu`,
  `app.setAsDefaultProtocolClient`) silently overwrote each other.

  - `kit/` (`@lynxtron-examples/fiddle-kit`): the shared bridge helpers, Lynx UI
    kit, and runtime access to native classes the ESM shim omits. It ships inside
    the showcase as a `file:` dependency rather than as an independently released
    workspace package — a fetched showcase has no monorepo to resolve
    `workspace:*` against, and the kit is private so it cannot be published.
  - `config`: `createShowcaseConfig` gains `server` (and `entries`, for multi-entry
    showcases).
  - `lynxtron-go`: the gallery bakes in the fiddle catalog and lists all 55 fiddles
    grouped by upstream category with status badges, separate from the
    featured-showcase grid.

  The fiddles are pared back to the API demonstration itself and share the repo's
  Fiddle Dark language with `showcases/counter` and `showcases/system-monitor` —
  palette from `@lynxtron-examples/config/tokens.css`, labelled panels, and
  `var(--font-mono)` reserved for data. `partial` fiddles keep one plain line
  naming the gap; the tutorial prose that repeated the port matrix is gone.

  Each fiddle also lists the Lynxtron APIs it calls, in monospace, and tapping one
  opens its page in the published API reference. The lists are derived from each
  fiddle's own source rather than hand-written.

### Patch Changes

- dd950b6: Fix the fetch → install → build → run chain for showcases opened from the
  gallery, and make gallery thumbnails render again.

  Four separate failures, each of which made a fetched showcase unrunnable:

  - **pnpm aborted on a TTY prompt.** Installs are spawned by the app, never from
    a terminal, so pnpm's "remove node_modules?" confirmation had nothing to
    answer it and bailed with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The
    install environment now declares itself non-interactive.
  - **The workspace ran whatever pnpm the machine had.** `~/.lynxtron-go` pinned
    no `packageManager`, so on a machine with pnpm 11 it used that — and pnpm 11
    no longer reads `pnpm.onlyBuiltDependencies` from package.json and turns
    ignored build scripts into a hard error. `@lynx-js/lynxtron`'s postinstall
    downloads the runtime binary, so the install "succeeded" with no runtime.
    The workspace now pins the same pnpm as the monorepo, and declares
    `onlyBuiltDependencies` in pnpm-workspace.yaml as well (here and in the
    monorepo) so either pnpm major works.
  - **`@lynx-js/lynxtron-builder`'s postinstall patches `app-builder-lib` and
    `dmg-builder`**, which pnpm does not hoist. The monorepo carries both at its
    root for exactly this reason; the synthesized workspace now does too.
  - **Gallery thumbnails were blank in remote mode.** Lynx's `<image>` loader
    reads the URL itself rather than going through the window's fetch handler, and
    does not load https at all — the URL answered 200 and the image still never
    appeared. Thumbnails are now staged into the app's own bundle and referenced
    as local files, which also leaves a packaged build self-contained.

- 965289b: Three fixes found while testing the IDE surface.

  **The palette opened behind the code.** Native Scintilla views paint above all
  Lynx UI whatever the z-index says, so an overlay does not cover the editor — the
  editor covers the overlay. The Fiddle has handled this since it grew dialogs
  (App passes `overlayActive` and it detaches its editors); the IDE's single
  editor had no equivalent, so on that surface only the palette's footer showed
  below the editor's bottom edge. It now detaches while the palette or gallery is
  open, and re-attaches after — re-attach only, since re-pushing the text would
  also jump the caret to line 0.

  **One resolver, and reuse what is already on disk.** The Fiddle and the IDE are
  two views of one workspace, but each carried its own copy of "local source tree,
  else fetch" — two functions meaning the same thing, free to drift, sharing every
  failure anyway. They now share one, which also gained the step both were
  missing: `fetch` wipes and re-extracts its destination on every call, so opening
  a showcase in the Fiddle and then in the IDE downloaded and installed the same
  workspace twice, seconds apart. A materialized workspace is now reused, verified
  by reading its manifest so a half-extracted directory from an interrupted fetch
  is not mistaken for a usable one.

  **A failed workspace says so.** A window opened to prepare a showcase that never
  arrived showed the same "Open Folder" invitation as an idle one; the reason sat
  in the Output panel, which is closed by default. The editor area now names the
  failure and offers Try again.

- 09c97f2: Make Cmd+P actually search the workspace, add Cmd+K, and restyle the palette to
  the app's own design language with keyboard navigation.

  **Cmd+P could not really search files.** Its pool was the _sidebar's_ model:
  `openFolder` loads the root's direct children, and a directory's contents load
  only when the user expands it. A showcase keeps its source under `src/`, which
  is collapsed on open — so `App.tsx`, `index.tsx` and everything else real was
  invisible, and only the handful of root-level files were findable. The palette
  now indexes the workspace itself, walking it breadth-first a few directories per
  tick so the synchronous filesystem bridge does not stall the UI. With a full
  index, ordering matters: matches rank name-exact > name-prefix > name-substring

  > path-substring, and the list is capped at 200 rows.

  **Cmd+K** opens the same palette with `>` already typed — literally "Cmd+P then
  type `>`". The mode still derives from the prefix, so backspacing the `>` falls
  back to file search exactly as it does when typed by hand.

  It was the last surface still painted in hardcoded VS Code greys (`#252526`,
  `#3c3c3c`, `#007aff`), so it read as a different product from the Fiddle home
  and the showcase gallery beside it. It now uses the theme variables the rest of
  the app uses, which also means it follows the light theme instead of ignoring it.

  - **Keyboard navigation**, modelled on cmdk: `↑`/`↓` move the selection and wrap
    at the ends, `Home`/`End` jump, `Enter` activates the _selected_ row rather
    than always the first, and `Esc` closes. The selection is tracked by row key,
    not index, so narrowing the query keeps the same row selected instead of
    sliding the highlight onto whatever now sits in that position. Hover moves it
    too, so pointer and keyboard never disagree.
  - **Layering.** The overlay had no `z-index` at all and could fall behind the
    gallery overlay (300) and the Fiddle's dialogs (100/200). It is now 400.
    z-index alone is not sufficient against the native Scintilla editors, which
    paint above all Lynx UI — that was already handled, since App.tsx passes
    `overlayActive` while the palette is open so the Fiddle detaches them.
  - **Rows** are padded rather than a fixed 44px; a showcase row carries a name, a
    description and tags, and the fixed height clipped them.
  - **Monospace only for data** — paths and accelerators, not showcase prose.
    Accelerators moved to a trailing key chip, the way a real menu shows them.

- 0136cc3: Quick Open now opens files in the product you are looking at.

  The palette was born with the IDE, and its file rows always went to
  `openFile` — which writes App-level editor tabs that only the IDE renders. On
  the Fiddle surface, which is where the app starts and where the gallery's Open
  lands you, picking a file wrote it into state nothing displayed. Cmd+P looked
  broken there because half of it was.

  The palette stays App-level, since it has to float above both products, but its
  rows now come from whichever product is mounted:

  - **Fiddle surface** — the fiddle's own editors. Activating one calls the same
    `selectEditor` a sidebar click does, so a hidden file is revealed and focused
    rather than silently selected.
  - **Workspace surface** — the indexed file tree, opening into IDE tabs as
    before.

  Cmd+K is unaffected: commands are global and worked on both surfaces already.

  Also fixes the row path rendering. It was `fullPath.replace(rootPath + '/',
'')`, and a string argument to `replace` substitutes the _first_ match
  anywhere — with no workspace root the pattern was just `/`, so
  `src/app/App.tsx` rendered as `srcapp/App.tsx`.

- c238495: Make the window show one product at a time, and make the menu reach it.

  The app hosts two products — the Fiddle and the IDE workspace — but which one
  you saw was the product of _two independent booleans_, and the menu was
  hardwired to one of them. Nothing reconciled the two.

  - **One surface.** The visible product was `legacyIdeOpen && route.kind ===
'workspace'`: two flags for one mutually exclusive state, which made
    "workspace route, flag off" representable. In that state files opened into
    tabs nothing rendered, and Quick Open searched a workspace you thought you
    had left. It was reachable from the gallery: opening a fiddle while in a
    workspace cleared the flag but left the route. The surface is now derived
    from the route alone, so the state cannot be expressed.

  - **The menu follows the surface.** `fiddle:*` events are handled by
    Fiddle.tsx and `ide:*` by App.tsx, and only one of the two is mounted. Since
    the Fiddle port rewrote the menu around `fiddle:*`, every IDE accelerator had
    been sending to an unmounted component: **Cmd+S, Cmd+W, Cmd+O, Cmd+F,
    Cmd+Shift+F and Cmd+J all did nothing in the IDE workspace**, and App.tsx's
    six matching listeners had no sender at all. The renderer now reports its
    surface and the menu is rebuilt for it, so each accelerator reaches the
    product that is actually mounted.

  - **Each surface gets its own menu.** The workspace surface no longer shows
    New Fiddle, Run Fiddle, Stop Fiddle or Publish to Gist — none of which it can
    do — and gains Open Folder…, Close Tab, Find, Find in Files and Toggle Panel.
    The Fiddle surface is unchanged. Cmd+P and Cmd+K exist on both.

    Cmd+O in particular was not merely dead in the IDE: on the Fiddle surface it
    feeds the chosen folder to `loadLocalFiddle`, which rejects anything that is
    not already fiddle-shaped, so File ▸ Open could not open an ordinary project
    at all. The workspace surface now routes it to the IDE's own folder dialog.

- Updated dependencies [dd950b6]
- Updated dependencies [0e3d212]
  - @lynxtron-examples/cli@0.0.5

## 0.0.8

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.
- Updated dependencies [9f330d3]
  - @lynxtron-examples/cli@0.0.4

## 0.0.7

### Patch Changes

- 9bf366a: Workspace `package.json` now sets `pnpm.onlyBuiltDependencies` for `@lynx-js/lynxtron`, `@lynx-js/lynxtron-builder`, `@lynx-js/lynxtron-rebuild`, `better-sqlite3`, and `sqlite3`. Without this, pnpm 10 silently skips the Lynxtron postinstall, `@lynx-js/lynxtron/dist` never lands, and downstream showcase builds fail with LNK1104 (`node.lib` missing, todolist/sqlite3) or CMake `Lynxtron Windows import library not found` (native-texture-canvas).
- Updated dependencies [9bf366a]
  - @lynxtron-examples/cli@0.0.3

## 0.0.6

Direct version bump from 0.0.3 to align the release-installers tag naming
scheme (`lynxtron-go-v<version>`) with the intended installer track;
0.0.4 and 0.0.5 are intentionally skipped and will not be released.

## 0.0.3

### Patch Changes

- a3096be: - Move `@lynx-js/lynxtron` from `devDependencies` to `dependencies` so `electron-builder` (via the `lynxtron-builder` patch that uses the app's own `package.json#dependencies` as the app.asar allowlist) actually includes it in the packaged app. Fixes `Cannot find module '@lynx-js/lynxtron'` at showcase-run time.
  - Rename the deep link URL scheme from `lynxtron://` to `lynxtron-go://` to avoid overlapping with the underlying `@lynx-js/lynxtron` runtime namespace. Covers the shared scheme constant, macOS `CFBundleURLSchemes`, in-app help page, and tests.
  - Add `lynxtron-go://open?url=<bundle-url>` as a short alias for `lynxtron-go://lynxview_page?bundle=<bundle-url>` so external tools can hand out a shorter deep link when previewing a hosted `.lynx.bundle`. Both hosts accept `url=` and `bundle=` interchangeably and enforce the same http(s)-only guard.

## 0.0.2

### Patch Changes

- c2fc749: Bump `@lynx-js/lynxtron` toolchain (lynxtron, lynxtron-builder, lynxtron-dev-plugins, lynx-library-headers, lynxtron-rebuild) from 0.0.5 to 0.0.7. No showcase runtime behavior changes; toolchain-only update to unblock native rebuilds on Python 3.13+.
- Updated dependencies [c2fc749]
  - @lynxtron-examples/cli@0.0.2
