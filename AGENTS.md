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
- `pnpm changeset` — add a changeset (required for any PR that bumps a package)
- `node scripts/pack-showcases.mjs` — pack every showcase into `dist/showcase-artifacts/*.tgz`

### Release pipeline

- Versioning/publishing is driven by **Changesets** + GitHub Actions (`.github/workflows/`):
  - `ci.yml` — PR validation (install, build tooling, test, typecheck, `changeset status`)
  - `release.yml` — on push to `main`, opens a "Version Packages" PR; merging it publishes
    `@lynxtron-examples/config` to npm (OIDC trusted publishing) and creates a
    `lynxtron-go-v<version>` GitHub Release with installers (dmg/exe) + showcase `.tgz` assets
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

## TODO

- Dev mode (watch + hot reload)
- Global search (Search panel)
- Debug panel (run status, process management)
- URL scheme (`lynxtron://`) handler
- Pure Lynx UI showcases (no main.ts)
- `GITHUB_TOKEN` auth — remove when repo is public
