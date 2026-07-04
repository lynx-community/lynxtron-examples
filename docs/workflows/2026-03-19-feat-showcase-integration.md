# Feature: Lynxtron GO Showcase Integration
- Branch: feat/monorepo-architecture
- Created: 2026-03-19
- Status: completed
- Plan: `docs/superpowers/plans/2026-03-19-showcase-integration.md`
- Spec: `docs/superpowers/specs/2026-03-19-lynxtron-go-showcase-integration-design.md`

## Steps

### Step 1: Preload Showcase API — completed
### Step 2: Command Registry — completed
### Step 3: Quick Picker Command Palette Mode — completed
### Step 4: StatusBar Run Button — completed
### Step 5: Wire Everything in App.tsx — completed
### Step 6: Baked-in Showcase Registry — completed
### Step 7: Preview Script — completed

### Step 8: End-to-End Verification
- [x] Build all packages — 78 tests pass (8 CLI + 70 lynxtron-go)
- [x] `pnpm preview` full flow: pack → registry → build → launch
- [x] Cmd+P → `>` → command palette works
- [x] "Open Showcase" → baked-in list with counter (LOCAL badge)
- [x] Select counter → `file://` tarball fetch → extracts → opens source directory
- [x] CLI `file://` protocol — skips `pnpm install` when built dist/ exists
- **Status:** completed

## Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Blank screen on launch | TDZ: useEffect before useCallback declaration | Moved useEffect after declaration |
| CLI path = module ID (748/863) | rspack compiled `require.resolve()` | `__non_webpack_require__` |
| Command click no response | `onClose()` before `cmd.execute()` | Commands close picker themselves |
| "Open Showcase" flash | Picker close/reopen cycle | In-place mode switch |
| "No URL available" | No `.tgz` at build time | `npm pack` in preview script |
| "Invalid URL: file://" | URL validation rejected `file://` | Added `file://` to allowed prefixes |
| `pnpm install` fails in preview | Unnecessary install for built tarballs | Skip install when `dist/desktop/main.js` exists |

## New Components

| Component | Path |
|-----------|------|
| Command Registry | `src/app/commands/registry.ts` |
| Showcase Commands | `src/app/commands/showcase-commands.ts` |
| Output Panel | `src/app/components/Output/OutputPanel.tsx` |
| LogView (shared) | `src/app/components/shared/LogView.tsx` |

## Architecture Decisions

| Decision | Rationale |
|---------|-----------|
| Baked-in showcase registry | Build-time `define` injection, no runtime scanning |
| Unified `ShowcaseEntry.url` | Zero code diff between preview/remote |
| Skip install for built tarballs | `dist/desktop/main.js` exists → ready to run |
| `__non_webpack_require__` | Bypass rspack for runtime CLI path resolution |

## TODO
- [ ] Dev mode (watch + hot reload, no pack)
- [ ] URL scheme (`lynxtron://`) handler
- [ ] Run button e2e verification (open showcase dir → click Run → window opens)

## History
- 2026-03-19: Steps 1-7 implemented, 5 bugs fixed
- 2026-03-20: Step 8 completed — file:// fetch works, preview flow verified end-to-end
