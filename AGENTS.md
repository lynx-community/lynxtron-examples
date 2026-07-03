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

## Commands

- Use Node.js `>=22` for installs and builds. If needed, run `nvm use 22` before `pnpm install`.
- `pnpm install` — install all dependencies
- `pnpm build` — build all packages
- `pnpm test` — run all tests (78 total: 8 CLI + 70 lynxtron-go)
- `pnpm preview` — **one-command preview**: pack showcases + local registry + build + launch
- `pnpm preview:build` — preview build without launching
- `pnpm run generate-registry` — regenerate showcase-registry.json

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
  config/     Shared Lynx build config (@lynxtron-showcases/config)
  cli/        CLI tool (@lynxtron-showcases/cli)
              - src/commands/     fetch, build, run, list
              - src/registry/     URL resolver (GitHub/file:// → repo/local/external)
              - src/workspace/    ~/.lynxtron-go workspace manager
              - src/utils/        NDJSON protocol helpers
              - __tests__/        Unit tests (vitest)
showcases/
  counter/    Full Lynxtron app: src/app/ (UI) + src/main/desktop/ (host) + rspack.config.ts
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

## Development Roles

**This rule is mandatory for all AI agents working in this repository.**

- **Product decisions** are made by the main conversation (PM role). Product plan is at `docs/product-plan.md`. Read it before starting any new feature.
- **Implementation tasks** are dispatched to subagents. The PM does not write implementation code directly.
- **Workflow**: PM defines what to build → creates workflow MD → dispatches subagent to implement → reviews result
- **Showcase prioritization** follows the product plan's three slogans:
  1. Light-weight and fast (58MB vs 161MB)
  2. Native extensible (native views as first-class citizens)
  3. Cross platforms (Desktop + Web + Mobile native from one Lynx UI codebase)

## Commit Discipline

- Keep commits traceable: one commit should map to one independently understandable product capability, workflow step, or scoped infra change that can be reviewed and reverted on its own.
- Split shared infra changes from product UI or showcase changes when that improves traceability.
- Do not mix unrelated product areas in the same commit unless the files are tightly coupled and the combined diff is still easy to review.
- Never commit `node_modules`, build outputs, vendored code, or generated artifacts unless the PM explicitly requests that exception.
- If a task is blocked by a pre-existing verification issue, do not mark it complete or commit it as a finished feature without PM approval.

## Pre-Commit Verification

- New feature or showcase work must pass the relevant build, test, or smoke verification for that scope before it is committed.
- Docs-only changes may be committed without runtime verification, but the commit or workflow note must say that no runtime verification was needed.
- Product UI changes should include at least the narrowest meaningful smoke check for the touched surface; larger showcase work should prefer a build plus an end-to-end smoke verification.
- Infrastructure or registry changes should be verified with the smallest repeatable check that proves the change path, such as generation, build, or resolution of the affected artifact.
- Workflow docs or status updates must record what was verified before commit, and must call out any remaining blocked verification explicitly.

## TODO

- Dev mode (watch + hot reload)
- Global search (Search panel)
- Debug panel (run status, process management)
- URL scheme (`lynxtron://`) handler
- npm publish (remove local registry dependency)
- Pure Lynx UI showcases (no main.ts)
- `GITHUB_TOKEN` auth — remove when repo is public
