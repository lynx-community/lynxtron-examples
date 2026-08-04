# Lynxtron Showcases — Agent Guide

This document helps AI agents work effectively in this monorepo.

## Project Overview

- **Monorepo** managed by pnpm workspaces + changesets
- **Lynxtron** is an Electron-like runtime where `BrowserWindow` is replaced by `LynxWindow`
- **Showcases** are full Lynxtron apps (host process + Lynx UI), each runs as independent desktop window
- **Lynxtron GO** is the playground app (IDE shell) that fetches, browses, and runs showcases
- **Self-hosting**: Lynxtron GO is itself a showcase — it can load and run another instance of itself
- **CLI** (`packages/cli`) handles all showcase lifecycle operations (fetch/build/run/list)

## Artifact And Distribution Model

Key distinctions:

- **Showcase**: full Lynxtron app with `dist/desktop/`; not a UI-only bundle
- **Example artifact**: pure Lynx UI published artifact; not a showcase
- **Preview**: local validation of the **dist distribution model**, not a source-mode shortcut

Preview-specific rule:

- `pnpm preview` exists to prove that packed showcase artifacts can be consumed locally without requiring the user to manually rebuild showcase source code

When implementing or reviewing a feature, explicitly identify:

- artifact type
- distribution type
- runtime path

## Key Constraints

- Lynx is **not a browser**. No HTML elements (`div`, `span`). Use `<view>`, `<text>`, `<image>`.
- Events use `bindtap` (not `onClick`), `bindinput` (not `onChange`).
- Import React hooks from `@lynx-js/react` (not `react`).
- No DOM/BOM APIs (`window`, `document`, `localStorage` are unavailable).
- `preload.ts` should be treated as a **standard Node.js environment plus Lynxtron bridge APIs**. Normal Node globals and built-ins should be assumed available unless a real runtime verification shows otherwise.
- **Lynx TDZ is strict**: `useCallback` declarations must appear before any `useEffect` that references them. Lynx engine crashes on TDZ violations that browsers tolerate.
- Use `__non_webpack_require__` in preload.ts to bypass rspack compile-time `require.resolve()`.

### The failure mode to expect

Unsupported browser assumptions usually fail as a **silent no-op**, not an
exception. A typecheck and a green build prove nothing about runtime behaviour.
Never hide a missing capability behind optional chaining — assert it and fail
with an actionable message.

### Observed runtime behaviour

Collected while porting Electron's `docs/fiddles` (Lynxtron 0.0.3 → 0.0.8,
mainly macOS). **Treat each as a hypothesis to re-probe** when Lynx, Lynxtron,
Rspeedy, rspack, a native extension, or the OS changes — if a probe now
succeeds, use the supported behaviour and update this list.

**CSS and layout**
- `inline-flex` / `inline-block` do not reliably keep horizontal layout — use `display: flex` with an explicit `flex-direction: row`.
- `flex: 1` can collapse to zero height under an auto-height parent, and collapses a `<text>` to **zero width** in a row. Lynx 3.9 changed the shorthand to parse the omitted basis as `0%` rather than `0`, which does not help: `min-content` is unsupported and the shrink lower bound is `0px`, so nothing holds the text open the way `min-width: auto` does on the web. Use `flex-grow: 1` with `flex-basis: auto`.
- Inheritance is off by default but this repo turns it on (`enableCSSInheritance` in `lynx.config.ts`), and the default list already covers `color`, `font-family`, `font-size`, `font-style`, `font-weight`, `letter-spacing`, `line-height`, `text-align`, `text-decoration`, `text-shadow`, `direction`. A `<text>` that comes out unstyled is usually **not** an inheritance failure — check for a collapsed box or a more specific rule first. Declaring `customCSSInheritanceList` replaces the default list rather than extending it.
- `filter` supports `blur`, `grayscale`, `brightness`, `contrast`, `saturate` — **not `invert`**, and `brightness` cannot lift black. A monochrome asset that must work on both themes needs two files.
- Selector support is a subset: no `:first-child` / `:nth-child`, no `min()` / `max()`. `:hover` exists on desktop but keep it colour-only — a `:hover` layout flip leaves paint ghosts.
- `text-transform` is dropped; bake the casing into the string. Use `text-maxline="1"` for single-line truncation.
- Fully transparent surfaces are skipped by hit testing; give an invisible tappable area a near-transparent fill, or use `display: none` to release it.
- `-x-app-region: drag` is Lynx's spelling of Chromium's `-webkit-app-region: drag` — it is what makes a custom title bar in a frameless window a window-move handle.
- Keyboard events exist: `bindkeydown` / `bindkeyup`, plus `global-bind*` variants that fire regardless of focus. The event carries `key`.

**Assets**
- SVG decoding renders blank; PNG through `<image>` is reliable.
- **`<image>` does not load `https://` at all** — the loader reads the URL itself rather than going through the window's fetch handler. Bundle images locally and reference them as `file://`.
- Icon fonts work via `lynx.addFont` with a base64 `data:font/ttf` URL, but the success callback fires without proving glyphs painted. Check visually.
- **Custom fonts have been seen to stop resolving around a platform overlay** — glyphs repainted afterwards came back as tofu, and re-registering under a fresh family name did not fix it (nor did a bundled `@font-face` with an inlined `data:` URI). **Trigger unconfirmed.** It reproduced with a full-window, long-lived `cover-view` under an older background arrangement, and does NOT reproduce with a transient dialog on the current code. Recorded so the symptom is recognizable, not as a rule to design around: if icons turn to tofu, this is the shape of it, but do not assume any overlay causes it.
- `btoa` does not exist in the Lynx UI.

**Bridge**
- `bridge.call(method, payload, reply)` is **callback-based**, not promise-based. Wrap it once.
- Main→UI events: `win.sendGlobalEvent(...)`, received via `lynx.getJSModule('GlobalEventEmitter')`. There is no bare `GlobalEventEmitter` global.
- The package's ESM shim re-exports only part of the native `lynxtron` module — `Notification`, `TouchBar*`, `UtilityProcess`, `Task` and others need `createRequire`. Inspect the real exports; do not trust remembered Electron names (it is lowercase `nativeImage`, and `globalShortcut` / `nativeTheme` / `desktopCapturer` / `webContents` are absent as of 0.0.8).
- Probe the *actual* object exposed to the UI. A bridge intended as `foundation.*` was in fact spread onto the exposed root, and optional chaining hid every dead call.

**Native views**
- Native child views float above the regular Lynx surface and are not clipped by Lynx ancestors. Give hosts `min-width: 0`, `min-height: 0`, `overflow: hidden` and verify in the real window.
- UI that must cover a native child view must use a `<cover-view>` root. Clay renders its children into a platform overlay slice; ordinary `<view>` plus `z-index` cannot cross the native-view boundary. Keep the covered native view attached so focus, selection, scroll position, and paint state remain stable.
- **No Lynx element that overlaps a native view may paint a background — including the app root.** Clay promotes a background to its own sublayer, and the native child sits below all of them, so one `background-color` anywhere on the path down to the view is an opaque sheet over it and the region comes up blank while layout, mounting and content are all perfectly correct. Easy to misread as a compositor bug: the trace says "Mounting in Lynx renderer host" with the right rect either way. Put the ground on the **window** instead (`new LynxWindow({ backgroundColor })` / `setBackgroundColor`, the only surface strictly below both Lynx and native views) and spend element backgrounds only on leaves that do not overlap. Moving the ground to the app root instead LOOKS like it works and is a layer-order race — `.IDE` is a `<view>` inside `<page>`, not the render root, so it renders on some launches and hides the panes on others.
- **A `<cover-view>` swallows input across its own bounds**, and `pointer-events: none` does not reach the platform layer. The docs say children render "within those bounds" and that is also the hit region — so a host sized `width:100%; height:100%` makes the WHOLE window deaf, which is how a full-page surface ends up with its only exit (a control in the shell behind it) unreachable. Size the cover-view to what it actually covers, and give any modal surface an exit inside itself.
- **Reach for `<cover-view>` only when Lynx content must float OVER a native view that stays live.** The docs say to prefer a plain `<view>` with `position: fixed` when you only need to cover Clay-rendered content — and a surface that REPLACES the editors (a full-region page, not a floating dialog) qualifies once you detach them: set `suppressed` on the native view and there is nothing left to cover. That path costs no platform overlay, so it cannot swallow input or take the custom fonts with it. Detaching is not free — flush live text before it goes and re-push after it returns; `setText` is idempotent, so the re-push heals drift without clearing style bytes.
- Route application overlays through one shared `<cover-view>` host on the current macOS runtime. Rapidly adding a second external overlay surface can race Clay's asynchronous present path; a single host can stack multiple Lynx overlay subtrees without exercising that surface-growth path.
- A desktop native view must use the `lynx_view_t` passed as its registration opaque to resolve `lynx_view_get_native_window()`. On macOS mount it inside the returned renderer view so Clay's sibling `ClayOverlayView` remains above the whole subtree. On Windows use a child HWND under the returned parent and do not raise it above Clay's child overlay windows. Never rediscover the host via `keyWindow`, foreground-window enumeration, or an owned popup — those escape Clay's overlay ordering and break multi-window isolation.
- Content pushed before the first attach lands in the document but does not repaint. Re-sync after the first layout.
- Devtool screenshots **cannot see native views**, and cannot see `<cover-view>` content either — in both modes (`lynxview` and `--fullscreen`) an open palette, dialog, or gallery is simply absent from the image, while the same subtree is plainly there in `DOM.getDocument`. Do not read a missing overlay in a screenshot as a rendering bug; capture the OS window instead (`screencapture -x -l <CGWindowID>`).

**Processes and resource loading**
- The built-in `-on-fetch-resource` handler answers http(s) but returns empty for `file://`. It is a plain EventEmitter listener, so it can be replaced — establish ownership first, and restrict to explicit allowed roots.
- A destructive `readProcessOutput`-style drain must have exactly **one** owner; every other consumer reads through a non-destructive cursor.
- `spawn(process.execPath, [projectDistDir])` from a Lynxtron main process launches another Lynxtron app — this is how per-app process isolation is done.
- App-global APIs (`Menu.setApplicationMenu`, `app.dock.setMenu`, `app.setAsDefaultProtocolClient`) are last-writer-wins across windows in one process. Independent demos need independent processes.
- Devtool client ports (8901, 8902, …) shuffle between restarts; match the session's bundle URL, not the port. Launching more than ~6 instances at once leaves some unregistered.
- Synthetic CDP input is not the real input path: taps work, but drags, scrolling a `<scroll-view>`, and key events do not. Repeat critical interactions with real input.
- `Runtime.evaluate` lands in the JS **shell**, not the card — `lynx` is undefined there, which is easy to misread as "CDP cannot reach the app". It can: the card's scope is `multiApps[currentAppId]`, so `multiApps[0].lynx.createSelectorQuery()…` runs real app code, and `multiApps[0].setTimeout` is the card's timer (the shell has none). This makes `boundingClientRect`, `scrollIntoView`, and `GlobalEventEmitter` reachable from a script, which is the difference between guessing at layout and measuring it.
- `SelectorQuery.invoke({ method: 'boundingClientRect' | 'scrollIntoView' })` both work on desktop. An `id` prop surfaces in the CDP tree as the `idSelector` attribute, not `id` — searching a DOM dump for `id` finds nothing and suggests, wrongly, that the id never applied.

## Porting a Web/Electron product into Lynxtron

Treat the source as a product specification, not as code to translate.

**State the contract before writing code** — source revision, artifact type,
distribution type, the exact runtime path (which bundle, host, preload and
native files actually run), the shortest golden flow that proves the port is
useful, and the non-goals. Classify each source capability as `COPY` (portable
logic), `ADAPT` (same behaviour, new platform implementation), `REPLACE` (use an
existing Lynxtron capability), `DEFER`, or `DROP`.

**Layers, with narrow typed contracts between them:** Lynx UI → preload → host →
native extension. The UI owns presentation and product state and must not touch
files, processes or OS windows. Preload exposes specific operations
(`readProject`, `run`, `stop`), never raw `fs` or `child_process`. Use a native
extension only where the other layers genuinely cannot deliver.

**Implement in vertical slices**, each ending in the smallest real check:
boot → input → execute → output/stop → persistence → polish. Do not finish a
layer before connecting it to the next.

**Verify in layers.** Static checks and unit tests, then a scoped build, then
launching the *same distribution a user consumes* — for a showcase that is
`dist/desktop/`, not a dev server. Then the golden flow end to end, including
one representative failure and cleanup after stop. A green build is a screening
signal, never acceptance.

**Done means:** the golden flow runs from the real distribution; no HTML/DOM/BOM
assumptions remain; missing bridge capabilities fail loudly; success, failure,
stop and exit are all verified; no stale bundle is being exercised; known gaps
are listed honestly rather than reported as supported; and every intentional
divergence from upstream records source behaviour, target behaviour, reason and
verification, so nobody later "fixes" it back.

## Commands

- Use Node.js `>=22` for installs and builds. If needed, run `nvm use 22` before `pnpm install`.
- `pnpm install` — install all dependencies
- `pnpm build` — build all packages
- `pnpm test` — run all tests (209 total: 14 CLI + 195 lynxtron-go)
- `pnpm preview` — **one-command preview**: pack showcases + local registry + build + launch
- `pnpm preview:build` — preview build without launching
- `pnpm run generate-registry` — regenerate showcase-registry.json
- `pnpm changeset` — add a changeset (required for any PR that bumps a package)
- `node scripts/pack-showcases.mjs` — pack every showcase into `dist/showcase-artifacts/*.tgz`

### Release pipeline

- Versioning/publishing is driven by **Changesets** + GitHub Actions (`.github/workflows/`):
  - `ci.yml` — PR validation (install, build tooling, test, typecheck, `changeset status`)
  - `release.yml` — on push to `main`, opens a "Version Packages" PR; merging it publishes
    updated `@lynxtron-examples/*` packages to npm (token-based, `NPM_CONFIG_PROVENANCE: true`)
  - `release-installers.yml` — **manual only** (`workflow_dispatch`); builds mac dmg + win exe
    + showcase `.tgz` and attaches them to a Release (created on demand if the tag does
    not exist yet). Tag defaults to `lynxtron-go-v<version>` on `main` (tracks Changesets
    patch bumps in `lynxtron-go/package.json`) and `lynxtron-go-v<version>-<sha6>` on any
    other branch (per-commit pre-release, does not clobber the stable Release).
    Runs independently of `release.yml` so installer/asset failures don't block npm publish
    and vice-versa.
- Showcases and `lynxtron-go` are `private` but still versioned/changelogged
  (`.changeset/config.json` → `privatePackages.version: true`); they are not published to npm.
- See [docs/showcase-development.md](docs/showcase-development.md) "Release" for the full flow.

### pnpm install verification

- After `pnpm install`, run `pnpm ignored-builds` to check whether pnpm skipped any required install scripts.
- If pnpm reports ignored build scripts for Lynxtron packages, run `pnpm approve-builds` and allow:
  - `@lynx-js/lynxtron`
  - `@lynx-js/lynxtron-builder`

## Keyboard Shortcuts (Lynxtron GO)

| Shortcut | Action |
|----------|--------|
| Cmd+P | Quick Open (files) / Command Palette (type `>`) |
| Cmd+S | Save current file |
| Cmd+W | Close current tab |
| Cmd+Shift+O | Open Folder |
| Cmd+J | Toggle bottom panel |
| Cmd+R | **Run Showcase** |
| Cmd+Shift+R | **Stop Showcase** |

## Project Layout

```
packages/
  config/     Shared Lynx build config (@lynxtron-examples/config)
  cli/        CLI tool (@lynxtron-examples/cli)
              - src/commands/     fetch, build, run, list
              - src/registry/     URL resolver (GitHub/file:// → repo/local/external)
              - src/workspace/    ~/.lynxtron-go workspace manager
              - src/utils/        NDJSON protocol helpers
              - __tests__/        Unit tests (vitest)
showcases/    10 showcases; each a full Lynxtron app:
              src/app/ (UI) + src/main/desktop/ (host) + rspack.config.ts
  counter/            the minimal reference showcase
  electron-fiddles/   Electron's docs/fiddles set — loose per-fiddle source under
                      fiddles/<upstream/path>/, assembled into a standalone
                      project on demand by scripts/assemble.mjs; catalog.ts is
                      the single source of truth and lynxtron-go's gallery
                      parses it at build time
lynxtron-go/  Lynxtron GO IDE shell (also a self-hosting showcase)
              - src/app/          Lynx UI layer
              - src/app/commands/ Command registry + showcase commands
              - src/app/components/StatusBar/  StatusBar with item registry (left/right)
              - src/app/components/Output/     Output panel (colored log, text-selection)
              - src/app/components/shared/     LogView (shared by Terminal + Output)
              - src/main/desktop/ Host process (main.ts with Run menu, preload.ts with showcase API)
              - src/extension-host/  Language services (TypeScript, CSS)
scripts/
  preview.sh           One-command preview flow (pack + registry + build + launch)
  local-registry.sh    Local verdaccio registry for testing
  generate-registry.ts Generate showcase-registry.json
```

## Lynxtron GO Architecture

### StatusBar (window bottom, full width)
- **Item registry**: `statusbar-registry.ts` — register items with `align: 'left' | 'right'` and `priority`
- **Left items**: language, run status (pid when running)
- **Center**: status message
- **Right items**: save indicator
- No action buttons — Run/Stop via menu hotkeys only

### Showcase Integration
- **Baked-in registry**: `showcase-registry.json` injected at build time via `__SHOWCASE_REGISTRY__` define
- **Unified URL model**: `ShowcaseEntry.url` — preview uses `file://` tarballs, release uses GitHub URLs
- **Preview mode**: `LYNXTRON_PREVIEW=1` env var at build time
- **Command palette**: Cmd+P → `>` for commands
- **Run menu**: `Run > Run Showcase (Cmd+R)` / `Run > Stop Showcase (Cmd+Shift+R)`

### Scintilla native editor (`lynxtron-go/scintilla-extension`)

- **Do not modify vendored sources under `scintilla-extension/scintilla/`.**
  Implement product behaviour in the Lynxtron-owned adapter
  (`module/scintilla_view.mm`), using extension points such as
  `contentViewClass`. Every editor fix so far has been possible that way.
- Several editor behaviours are deliberate customisations, not defaults — do not
  "restore" them: whole-line scroll snapping is disabled on purpose (continuous
  trackpad scrolling), the elastic-overscroll area is painted with the editor
  theme background, margin painting is clipped to the content viewport so line
  numbers cannot bleed into the panel below, and constructor styling plus
  `ApplyTheme` run synchronously on the main thread to avoid a first-frame
  14pt/default-theme flash.

### Preload Showcase API
```typescript
showcase.fetch(url)       // fetch from URL (GitHub or file:// tarball)
showcase.run(path)        // spawn independent lynxtron process
showcase.list()           // list downloaded showcases
showcase.isShowcase(dir)  // check package.json for showcase field
showcase.isBuilt(dir)     // check dist/desktop/main.js exists
```

## Creating a Showcase

Each showcase is a full Lynxtron app:
1. Create `showcases/<name>/` with `package.json` (showcase metadata), `lynx.config.ts`, `rspack.config.ts`
2. Write UI in `src/app/`, host in `src/main/desktop/`
3. Build: `pnpm run build` (rspeedy + rspack dual pipeline)
4. Run: `lynxtron ./dist/desktop`
5. Update registry: `pnpm run generate-registry`

See [docs/showcase-development.md](docs/showcase-development.md).

## TODO

- Dev mode (watch + hot reload)
- Global search (Search panel)
- Debug panel (run status, process management)
- URL scheme (`lynxtron-go://`) handler
- Pure Lynx UI showcases (no main.ts)
