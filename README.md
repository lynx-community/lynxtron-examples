# Lynxtron Showcases

A monorepo of Lynxtron showcase apps. **Lynxtron Go** is a project editor and
showcase runner that can fetch, edit, build, and run any showcase in this
repository.

## Repository Structure

```
lynxtron-show-cases/
  packages/
    config/         @lynxtron-examples/config  — shared Lynx build config preset
    cli/            @lynxtron-examples/cli     — CLI for fetching, building, running showcases
  showcases/
    counter/        minimal counter example (full Lynxtron app)
  lynxtron-go/      Lynxtron Go project editor and showcase runner
  scripts/
    preview.sh          one-command preview flow
    local-registry.sh   local npm registry for testing
    generate-registry.ts  auto-generate showcase-registry.json
```

## Prerequisites

- Node.js >= 22
- pnpm 10.x
- If you use `nvm`, run `nvm use 22` before installing dependencies

## Install Notes

The repo pins runtime and toolchain expectations in root configuration:

- root `package.json` requires Node.js `>=22` and pins `pnpm@10.15.1`;
- `pnpm-workspace.yaml` allows the Lynxtron runtime, builder, and required
  native dependencies to run their install scripts.

After `pnpm install`, check whether pnpm skipped any build scripts:

```bash
pnpm ignored-builds
```

If pnpm reports ignored build scripts for Lynxtron packages, approve them before running the apps:

```bash
pnpm approve-builds
```

Allow:

- `@lynx-js/lynxtron`
- `@lynx-js/lynxtron-builder`

## Quick Start

```bash
# Install all dependencies
pnpm install

# Build everything
pnpm build

# Run tests
pnpm test
```

## Preview Mode (Development)

One command to pack all showcases, start a local npm registry, build Lynxtron Go in preview mode, and launch:

```bash
pnpm preview
```

This will:
1. Build each showcase and pack its source plus verified `dist_precompiled/` artifact
2. Start a local Verdaccio registry and publish `@lynxtron-examples/*` packages
3. Build Lynxtron Go with `LYNXTRON_PREVIEW=1` (bakes `file://` tarball URLs)
4. Launch Lynxtron Go desktop app

In the app, open the Gallery from the folder button in the command bar. The
command palette also exposes showcase commands through **Cmd+P → `>`**.

```bash
# Build only (don't launch)
pnpm preview:build
```

## Creating a New Showcase

See [docs/showcase-development.md](docs/showcase-development.md) for the full guide.

Each showcase is a **full Lynxtron application** (host process + Lynx UI):

```
showcases/my-app/
  package.json          # metadata + deps
  lynx.config.ts        # re-export from @lynxtron-examples/config
  rspack.config.ts      # host process build (per-showcase)
  src/
    app/                # Lynx UI (platform-agnostic)
    main/desktop/       # Desktop host (main.ts, preload.ts)
```

## CLI Usage

```bash
# Fetch a showcase from GitHub
lynxtron-examples fetch 'https://github.com/user/repo/tree/main/showcases/counter'

# Build a fetched showcase
lynxtron-examples build counter

# Run a built showcase (opens independent desktop window)
lynxtron-examples run counter

# List locally available showcases
lynxtron-examples list
```

## Lynxtron Go Commands

Open the command palette with **Cmd+P → type `>`**:

| Command | Action |
|---------|--------|
| Open Showcase | Browse baked-in showcase list, select to fetch |
| Open Showcase (URL) | Enter a custom GitHub URL to fetch |
| Run Showcase | Launch current showcase as independent window |
| Open Folder | Open a local directory |

## Testing

```bash
# Run all tests
pnpm test

# Run CLI tests only
cd packages/cli && pnpm test

# E2E test (local registry + fetch from GitHub + build)
./scripts/local-registry.sh auto
```

## Architecture

See [AGENTS.md](AGENTS.md) for the architecture, the runtime constraints Lynx
imposes, and the porting process; see
[docs/showcase-development.md](docs/showcase-development.md) for how to build,
test and release a showcase.

Key design decisions:
- **Full Lynxtron apps**: Each showcase includes host process + Lynx UI, runs as independent desktop window
- **Host-owned execution**: preload services and the CLI install, verify, build,
  cache, and launch projects outside the Lynx renderer
- **Baked-in registry**: Showcase list injected at build time; preview uses `file://` tarballs, release uses GitHub URLs
- **Unified URL model**: Zero code difference between preview and production
- **Shared toolchain**: Core Lynx SDK and build tools managed at workspace level
- **NDJSON protocol**: CLI communicates with Lynxtron Go via newline-delimited JSON on stdout
