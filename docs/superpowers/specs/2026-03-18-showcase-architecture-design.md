# Lynxtron Show Cases - Monorepo Architecture Design

## Overview

Design for organizing the lynxtron-show-cases monorepo: how multiple showcase apps coexist, how they are distributed and loaded by Lynxtron GO (a playground app similar to Electron Fiddle), and how dependencies/toolchains are managed.

## Core Decisions

| Decision | Choice |
|----------|--------|
| Showcase interaction model | Playground: users can edit code and recompile |
| Build environment | User's local Node.js + pnpm |
| Distribution | Git-based (GitHub tarball API), with registry extensibility |
| Shared component library | Published to npm as regular package (deferred) |
| Core toolchain management | Lynxtron GO local workspace (for repo showcases); full standalone install (for external) |
| Build configuration | Shared preset package, showcase zero-config |
| Architecture | Thin Launcher: CLI handles logic, Lynxtron GO is a UI shell |
| **Showcase scope** | **Full Lynxtron apps (host process + Lynx UI), not UI-only bundles** |
| **Running showcases** | **Lynxtron GO spawns independent process per showcase** |

## 1. Showcase Structure

Each showcase is a **complete Lynxtron application**, structurally identical to any Lynxtron app (like Lynxtron GO itself). A showcase produces multiple build artifacts:

```
showcases/counter/
  package.json                    # metadata + dependencies
  lynx.config.ts                  # RSpeedy config (Lynx UI) — re-exports shared preset
  rspack.config.ts                # Rspack config (host process) — re-exports shared preset
  src/
    app/                          # Lynx UI layer (platform-agnostic)
      index.tsx
      App.tsx
      App.css
    main/
      desktop/                    # Desktop host
        main.ts                   # LynxWindow setup, bridge handlers
        preload.ts                # Node.js APIs exposed to Lynx
        vendorPaths.ts            # Bundle path constants
      web/                        # Web host (optional)
        web-host.ts               # Browser entry, setupSymmetricHost()
        nodejs_adapter_web.ts     # Web Worker Node.js simulation
        index.html
  dist/
    desktop/                      # Desktop build output
      main.js                     # Compiled host process
      preload.js                  # Compiled preload
      main.lynx.bundle            # Lynx UI bundle
      package.json
    web/                          # Web build output (optional)
      index.html
      web-host.js
      main.web.bundle
      *.wasm
```

### Build pipeline (dual)

```
rspeedy build                     → output/bundle/lynx/main.lynx.bundle
                                  → output/bundle/web/main.web.bundle (if web target)

rspack build                      → dist/desktop/ (main.js, preload.js, copies lynx bundle)
                                  → dist/web/ (web-host.js, copies web bundle, generates index.html)
```

## 2. Monorepo Structure

```
lynxtron-show-cases/
  package.json                          # root, pnpm workspace
  pnpm-workspace.yaml                   # packages/*, showcases/*
  showcase-registry.json                # auto-generated showcase manifest

  packages/
    config/                             # @lynxtron-showcases/config
      package.json
      dist/                             # compiled JS (published to npm)
      src/
        lynx.config.ts                  #   default RSpeedy config for Lynx UI
        rspack.config.ts                #   default Rspack config for host process (desktop + web)
        index.ts                        #   re-export configs

    cli/                                # @lynxtron-showcases/cli
      package.json
      src/
        commands/
          fetch.ts                      #   download showcase (git/registry)
          build.ts                      #   build showcase (rspeedy + rspack)
          run.ts                        #   spawn lynxtron process to run showcase
          list.ts                       #   list available showcases
        workspace/
          manager.ts                    #   manage ~/.lynxtron-go workspace
        registry/
          resolver.ts                   #   resolve showcase source (git/registry)

  showcases/
    counter/                            #   minimal counter — full Lynxtron app
      package.json
      lynx.config.ts
      rspack.config.ts
      src/
        app/                            #     Lynx UI
        main/
          desktop/                      #     desktop host (main.ts, preload.ts)
          web/                          #     web host (optional)

  lynxtron-go/                          # Lynxtron GO app (UI shell)
    package.json
    src/
      app/                              #   Lynx UI (editor, showcase list, etc.)
      main/
        desktop/
          main.ts                       #   invokes CLI, spawns showcase processes
```

**Key change from v1:** `serve` command replaced by `run` command — showcases are launched as independent Lynxtron processes, not served as static files.

## 3. Showcase Distribution & Loading

### Two sources, two paths

**Repo showcase (Git-based):**

1. User inputs URL (e.g. `github.com/user/lynxtron-show-cases/tree/main/showcases/counter`)
2. CLI resolver identifies as repo showcase
3. Download via GitHub tarball API (`/repos/{owner}/{repo}/tarball/{ref}`), extract only the `showcases/counter/` directory. This is a stateless download — no `.git` directory, no repo history. Updates are handled by re-fetching (not `git pull`).
4. Place into `~/.lynxtron-go/showcases/counter/`
5. CLI rewrites `workspace:*` references in `package.json` to real version numbers
6. `pnpm install` in workspace context (shared toolchain, only installs business deps)
7. `rspeedy build && rspack build` (dual pipeline, uses `@lynxtron-showcases/config` preset)
8. Output `dist/desktop/` → Lynxtron GO spawns `lynxtron ./dist/desktop` as independent process

**External standalone package:**

1. User inputs URL (any git repo or registry URL)
2. CLI resolver identifies as external package
3. Clone/download to `~/.lynxtron-go/external/<name>/`
4. Standalone `pnpm install` (self-contained dependency declaration)
5. `pnpm run build` (uses the project's own build config)
6. Output `dist/desktop/` → Lynxtron GO spawns `lynxtron ./dist/desktop` as independent process

### Local Workspace Structure

```
~/.lynxtron-go/
  package.json                # toolchain deps: @lynx-js/react, rspeedy, rspack,
                              #   @lynxtron-showcases/config, lynxtron, etc.
  pnpm-workspace.yaml         # showcases/*
  showcases/                  # repo showcases, shared toolchain
    counter/
  external/                   # external packages, fully isolated
    some-third-party-app/
  external-registry.json      # saved external showcase URLs
```

- `package.json` includes core Lynx SDK deps, Rspack, Lynxtron runtime, AND shared config package
- Toolchain versions follow Lynxtron GO version by default, updated on app upgrade
- Users can manually modify toolchain versions
- `external/` is NOT in the workspace, fully isolated

### Dependency resolution for fetched showcases

When a repo showcase is fetched into the local workspace:

1. **CLI rewrites `workspace:*`** in the showcase's `package.json` to the actual version installed in `~/.lynxtron-go/package.json`.
2. **Shared packages** (`@lynxtron-showcases/config`) are declared in the workspace root `package.json`, so they resolve via hoisting.
3. **Core Lynx SDK and Rspack** (`@lynx-js/react`, `@lynx-js/rspeedy`, `@rspack/core`, `@rspack/cli`) are also in the workspace root, shared across all showcases.
4. **Lynxtron runtime** (`@lynx-js/lynxtron`) is in the workspace root — needed to run `lynxtron ./dist/desktop`.
5. **Business dependencies** declared in the showcase's own `package.json` are installed per-showcase by pnpm, with dedup via pnpm's global store.

## 4. Shared Config Package

`@lynxtron-showcases/config` provides a zero-config preset for the **Lynx UI build** (RSpeedy) only.

### Lynx config (RSpeedy) — shared

```typescript
// showcases/counter/lynx.config.ts
export { default } from '@lynxtron-showcases/config/lynx';

// Or with customization:
import { createShowcaseConfig } from '@lynxtron-showcases/config';
export default createShowcaseConfig({ entry: './src/app/custom.tsx' });
```

Provides: entry point, output filename pattern, pluginReactLynx, dual environments (lynx + optional web).

### Rspack config (host process) — per showcase

Each showcase writes its own `rspack.config.ts` because:
- Host layer varies significantly (entry points, externals, web target support)
- Not all showcases have web target
- Some showcases have native extensions, custom preloads, etc.

Showcases can reference `lynxtron-shell-demo` as a template. Future scaffold tooling can auto-generate this.

## 5. Shared Package Publishing & Versioning

### npm packages

| Package | npm Name | Purpose |
|---------|----------|---------|
| `packages/config` | `@lynxtron-showcases/config` | Shared build config preset (lynx + rspack) |
| `packages/cli` | `@lynxtron-showcases/cli` | CLI tool (also a Lynxtron GO dependency) |

### Version strategy

- **Unified version number** across packages, managed by changesets
- Monorepo showcases reference via `workspace:*`, replaced with real version on `pnpm publish`
- Showcases themselves are NOT published to npm; distributed via Git

### CI pipeline

```
push to main
  |
  |-- changeset detects packages/ changes -> publish npm packages
  |
  |-- for each showcases/*: rspeedy build && rspack build + test -> verify showcase
  |
  |-- auto-generate showcase-registry.json from showcases/*/package.json
```

## 6. Version Compatibility

### Showcase metadata

Each showcase declares a `showcase` field in its `package.json`:

```json
{
  "name": "counter",
  "showcase": {
    "description": "Minimal counter example",
    "thumbnail": "thumbnail.png",
    "tags": ["beginner"],
    "minToolchainVersion": "0.1.0"
  }
}
```

- `minToolchainVersion`: minimum version of the `@lynxtron-showcases/*` toolchain required
- CI uses this field to auto-generate `showcase-registry.json`

### Compatibility checks

When Lynxtron GO loads a repo showcase:
1. Read showcase's `showcase.minToolchainVersion`
2. Compare with the local workspace toolchain version
3. If incompatible: warn user with option to upgrade toolchain or proceed anyway

For external packages: no compatibility check (they manage their own deps).

## 7. Running Showcases

### Launch mechanism

Lynxtron GO runs a showcase by spawning an independent Lynxtron process:

```typescript
import { spawn } from 'child_process';

// CLI `run` command spawns:
const child = spawn('lynxtron', [showcaseDistPath], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Each showcase runs in its own process with its own window. Lynxtron GO does NOT load showcase bundles into its own process.

**Self-hosting:** Since Lynxtron GO itself is a Lynxtron app, it can theoretically be loaded by another instance of Lynxtron GO via the same mechanism.

### CLI `run` command

```bash
# Run a built showcase
lynxtron-showcases run counter

# Equivalent to:
lynxtron ~/.lynxtron-go/showcases/counter/dist/desktop
```

The `run` command:
1. Locates the showcase in the local workspace
2. Verifies `dist/desktop/` exists (errors if not built)
3. Spawns `lynxtron ./dist/desktop` as a child process
4. Streams stdout/stderr and emits NDJSON events for process lifecycle

### CLI-to-App communication

CLI runs as a child process of Lynxtron GO, communicates via **newline-delimited JSON (NDJSON)** on stdout:

```typescript
const rl = createInterface({ input: cli.stdout });
rl.on('line', (line) => {
  const event = JSON.parse(line);
  // { type: 'run-start', name: 'counter', pid: 12345 }
  // { type: 'run-exit', name: 'counter', code: 0 }
  // { type: 'build-start' }
  // { type: 'build-success', distPath: '/path/to/dist/desktop' }
  // { type: 'build-error', errors: [...] }
});
```

Each JSON message is a single line terminated by `\n`. Human-readable logs go to stderr.

## 8. Edit & Recompile Mechanism

### Current scope (v1)

- **Distribute built `dist/`**: CLI `fetch` + `build` + `run` flow works end-to-end
- **Source code browsing**: Lynxtron GO can display source files from fetched showcases

### TODO (future)

- **Dev mode**: `rspeedy dev` + `rspack dev` with watch + auto-restart showcase process
- **Pure Lynx UI showcases**: Support showcases without `main.ts` (Lynxtron GO provides a generic host)
- **In-app editing**: Edit source in Lynxtron GO, trigger rebuild, restart showcase

### Persistence of edits

- Edits persist locally in `~/.lynxtron-go/`
- User can re-fetch to reset to original version
- No push-back-to-remote capability (not Lynxtron GO's responsibility)

## 9. Showcase Discovery (Registry)

### Remote manifest

`showcase-registry.json` at monorepo root, auto-generated by CI:

```json
{
  "version": 1,
  "showcases": [
    {
      "name": "counter",
      "description": "Minimal counter example",
      "path": "showcases/counter",
      "thumbnail": "showcases/counter/thumbnail.png",
      "tags": ["beginner"]
    }
  ]
}
```

- Auto-generated by CI from `showcases/*/package.json` `showcase` field (see Section 6)
- Lynxtron GO fetches via raw GitHub URL as showcase directory
- Future migration to self-hosted registry: just change the hosting URL, format stays the same

### Local discovery

- Scan `~/.lynxtron-go/showcases/` and `~/.lynxtron-go/external/`, read `package.json` for metadata
- External showcases saved in `~/.lynxtron-go/external-registry.json` for persistence across sessions
