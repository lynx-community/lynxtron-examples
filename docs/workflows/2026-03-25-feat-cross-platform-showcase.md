# Feature: Cross-Platform Notes Showcase
- Branch: feat/monorepo-architecture
- Created: 2026-03-25
- Status: completed
- Runtime Baseline: `@lynx-js/lynxtron@0.0.1-alpha.14`

## Goal

Create a showcase that demonstrates Lynxtron's #1 differentiator: **same code, desktop + web**. Build a Markdown notes app that runs identically on both platforms and proves the shared UI code path.

## Observability
- **Log command:** `tail -f /tmp/lynxtron_stdout.log` (desktop) / browser console (web)
- **Observation:** side-by-side desktop window + browser tab

## Steps

### Step 0: Scaffold cross-platform showcase
- [x] Create `showcases/cross-platform-notes/` with package.json, lynx.config.ts (dual env: lynx + web), rspack.config.ts (desktop + web targets)
- [x] Verify: `pnpm run build` produces both `dist/desktop/` and `dist/web/`
- [x] Step commit
- **Verification:** `ls dist/desktop/main.lynx.bundle dist/web/main.web.bundle`

### Step 1: Desktop + Web host process
- [x] `src/main/desktop/main.ts` — minimal LynxWindow host
- [x] `src/main/web/web-host.ts` — browser host with setupSymmetricHost
- [x] `src/main/web/index.html` — HTML shell
- [x] Verify: `npm start` opens desktop window, `npm run start:web` opens browser
- [x] Step commit
- **Verification:** both show a shared placeholder notes shell with the same top-level layout

### Step 2: Notes UI
- [x] Shared notes layout: left note list, right Markdown editor, bottom platform info bar
- [x] Initial data: at least one sample note, selectable and editable
- [x] Responsive — same layout adapts to desktop window and browser viewport
- [x] Step commit
- **Verification:** notes list, editor, and platform bar render correctly on desktop and web

### Step 3: Storage adapters
- [x] Desktop storage via filesystem in preload
- [x] Web storage via localStorage or a browser-safe equivalent behind the same UI API
- [x] Autosave debounce for note edits
- [x] Step commit
- **Verification:** create/update/select flows persist on both platforms

### Step 4: Register in showcase-registry + preview
- [x] Add showcase metadata to package.json
- [x] `pnpm run generate-registry`
- [x] Verify in Lynxtron GO: cross-platform notes appears in showcase list
- [x] Step commit
- **Verification:** `pnpm preview` → Open Showcase → cross-platform notes → runs

### Step 5: E2E verification
- [x] Desktop: `npm start` → notes window with list/editor interactions working
- [x] Web: `npm run start:web` → browser with identical UI
- [ ] Side-by-side screenshot comparison
- [x] Preview smoke verification on `alpha.14` and `pnpm preview`
- [x] Step commit

## History
- 2026-03-25: Workflow created
- 2026-04-01: Desktop + web MVP committed
- 2026-04-02: Desktop runtime verified on `0.0.1-alpha.14`; registry/gallery integration completed
- 2026-04-02: `pnpm preview` smoke verified; phase 2 closed except optional screenshot comparison
