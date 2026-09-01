# Showcase Development Guide

How to create, test, and publish showcases in this monorepo.

## What is a Showcase?

A showcase is a **full Lynxtron app**, not a UI-only Lynx bundle.

A showcase normally includes:

- Lynx UI code in `src/app/`
- desktop host code in `src/main/desktop/`
- optional web host code in `src/main/web/`

The desktop target is expected to build a runnable app payload under `dist/desktop/`.

Important distinctions:

- A **showcase** is a full Lynxtron app, not a UI-only example bundle
- An **example artifact** is a pure Lynx UI published artifact and does not imply `dist/desktop`
- `dist/` is always a local build directory; a published precompiled artifact is stored separately as `dist_precompiled/`
- `pnpm preview` validates the **precompiled distribution flow** locally; it is not a source-mode shortcut

## Environment Requirements

- Node.js `>=22`
- pnpm 10.x
- If you use `nvm`, run `nvm use 22` before installing dependencies

This repo relies on root-level pnpm settings to keep Lynxtron binaries installable:

- `engines.node` requires Node.js `>=22`
- `packageManager` is pinned to `pnpm@10.15.1`
- `pnpm.onlyBuiltDependencies` allows `@lynx-js/lynxtron` and `@lynx-js/lynxtron-builder` to run install scripts

After `pnpm install`, verify that no required build scripts were skipped:

```bash
pnpm ignored-builds
```

If pnpm reports ignored build scripts for Lynxtron packages, approve them before building or running a showcase:

```bash
pnpm approve-builds
```

Allow:

- `@lynx-js/lynxtron`
- `@lynx-js/lynxtron-builder`

## Creating a Showcase

### 1. Scaffold the directory

```bash
mkdir -p showcases/my-app/src/app
mkdir -p showcases/my-app/src/main/desktop
```

### 2. Create `package.json`

```json
{
  "name": "my-app",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "rspeedy build && rspack build",
    "dev": "cross-env TARGET_ENV=desktop NODE_ENV=development concurrently -k --raw \"rspeedy dev\" \"dev-ready-rspeedy && rspack dev\"",
    "start": "cross-env TARGET_ENV=desktop npm run build && lynxtron ./dist/desktop"
  },
  "showcase": {
    "description": "Brief description of what this showcase demonstrates",
    "tags": ["beginner"],
    "minToolchainVersion": "0.0.1"
  },
  "devDependencies": {
    "@lynxtron-examples/config": "workspace:*",
    "@lynx-js/react": "0.115.4",
    "@lynx-js/rspeedy": "^0.13.0",
    "@lynx-js/types": "3.6.0",
    "@rspack/cli": "^1.7.5",
    "@rspack/core": "^1.7.5",
    "@lynx-js/lynxtron": "0.0.1-alpha.14",
    "@lynx-js/lynxtron-dev-plugins": "0.0.1-alpha.14",
    "concurrently": "^8.2.2",
    "cross-env": "^10.1.0",
    "typescript": "~5.9.3"
  }
}
```

**Fields:**
- `showcase.description` — shown in Lynxtron GO's showcase list
- `showcase.tags` — used for filtering (`beginner`, `advanced`, `animation`, etc.)
- `showcase.minToolchainVersion` — minimum `@lynxtron-examples/*` version required
- `showcase.distribution` — omit for a GitHub Release asset; use `"builtin"`
  only for a standard showcase artifact embedded in the Lynxtron Go installer

### 3. Create `lynx.config.ts`

```typescript
export { default } from '@lynxtron-examples/config/lynx';
```

This gives you zero-config builds. If you need custom configuration:

```typescript
import { createShowcaseConfig } from '@lynxtron-examples/config';

export default createShowcaseConfig({
  entry: './src/custom-entry.tsx',
});
```

### 4. Create your app entry point

`src/app/index.tsx`:
```tsx
import { root } from '@lynx-js/react';
import { App } from './App';

root.render(<App />);
```

### 5. Write your UI

`src/app/App.tsx`:
```tsx
import { useState, useCallback } from '@lynx-js/react';

export function App() {
  const [count, setCount] = useState(0);

  const handleTap = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <view className="container">
      <text className="title">Count: {count}</text>
      <view className="button" bindtap={handleTap}>
        <text>Tap me</text>
      </view>
    </view>
  );
}
```

### 6. Add a desktop host

`src/main/desktop/main.ts`:

```ts
import { app, LynxWindow } from '@lynx-js/lynxtron';
import path from 'path';

app.whenReady().then(() => {
  const win = new LynxWindow({
    width: 960,
    height: 640,
    title: 'My Showcase',
  });
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
});
```

### 7. Add self-contained slice tsconfig files

Each showcase slice must ship with its own self-contained `tsconfig.json`.

Do not use `extends` that points outside the showcase package, for example `../../../tsconfig.app.json`. Lynxtron GO unpacks showcases into standalone workspaces under `~/.lynxtron-go/showcases/<name>`, so package-external `extends` paths will break diagnostics there even if they work inside this monorepo.

`src/app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@lynx-js/react",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["@lynx-js/types"]
  },
  "include": ["./**/*.ts", "./**/*.tsx", "./**/*.d.ts"]
}
```

`src/main/desktop/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["./**/*.ts", "./**/*.d.ts"]
}
```

If the showcase has a web host, add `src/main/web/tsconfig.json` too:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2023", "DOM"],
    "strict": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["./**/*.ts", "./**/*.d.ts"]
}
```

## Lynx UI Rules

Lynx is **not a browser**. Key differences:

| Web | Lynx |
|-----|------|
| `<div>` | `<view>` |
| `<span>`, `<p>` | `<text>` |
| `<img>` | `<image>` |
| `<ul>` | `<list>` |
| `onClick` | `bindtap` |
| `onChange` | `bindinput` |
| `import { useState } from 'react'` | `import { useState } from '@lynx-js/react'` |

**Not available:** `window`, `document`, `localStorage`, `:hover`, `nth-child`, complex CSS selectors.

**Layout:** Flexbox only (like React Native).

## Building and Testing

```bash
# Install dependencies (from monorepo root)
pnpm install

# Build your showcase
cd showcases/my-app
pnpm run build

# Dev mode with watch
pnpm run dev

# Local desktop smoke
lynxtron ./dist/desktop
```

Build outputs include:

- `output/bundle/lynx/main.lynx.bundle`
- `dist/desktop/main.js`
- `dist/desktop/preload.js`
- `dist/desktop/main.lynx.bundle`

## Published Showcase Artifact Format

Development builds continue to write `dist/`. The Release workflow must never
publish that directory with official artifact identity because the extracted
showcase is editable and subsequent local builds also write `dist/`.

Each published showcase tarball has this layout:

```text
package/
├── .lynxtron-release.json
├── package.json
├── lynx.config.ts
├── rspack.config.ts
├── src/...
└── dist_precompiled/
    ├── desktop/
    │   ├── main.js
    │   ├── main.lynx.bundle
    │   └── package.json
    └── web/...                  # only when the showcase has a web target
```

The public tarball must not contain `dist/` or `output/`. `pnpm run build`
creates those local/intermediate directories first. The packaging script runs
`pnpm pack`, removes `package/dist` and `package/output` from the packed payload,
injects the completed build as `package/dist_precompiled`, and then writes the
release manifest. The manifest is written after `pnpm pack` has normalized
`catalog:` and `workspace:` dependency versions, so consumers hash exactly the
same `package.json` bytes that were published.

The normalized dependency versions must already exist on npm and expose every
subpath referenced by the packed source. A workspace link proving that a local
build succeeds is not release evidence. In particular, each showcase keeps the
small `{'@lynx-js/lynxtron': 'commonjs lynxtron'}` Rspack external mapping inline
instead of importing a workspace-only helper; this lets source fallback build
against the published `@lynxtron-examples/config` version. A new shared config
API must be published to npm before any installer or showcase artifact starts
referencing it.

### Release manifest and hashes

`.lynxtron-release.json` binds one published source snapshot to one complete
precompiled artifact tree:

```json
{
  "schemaVersion": 1,
  "hashAlgorithm": "sha256-tree-v1",
  "source": { "hash": "<sha256>" },
  "artifact": {
    "root": "dist_precompiled",
    "hash": "<sha256>",
    "files": ["desktop/main.js", "desktop/main.lynx.bundle", "desktop/package.json"],
    "targets": {
      "desktop": {
        "root": "desktop",
        "requiredFiles": ["main.js", "main.lynx.bundle", "package.json"]
      }
    }
  }
}
```

The source hash covers every file in the published package payload except these
top-level implementation or generated entries:

```text
.git/
.lynxtron-go-cache.json
.lynxtron-release.json
dist/
dist_precompiled/
node_modules/
output/
```

`main.lynx.bundle`, `main.js`, and everything else below
`dist_precompiled/` are artifacts and must never participate in the source
hash. The artifact hash covers the complete `dist_precompiled/` tree. Hashing
uses sorted POSIX relative paths plus each file's SHA-256 content hash; mtimes
and absolute paths are never inputs.

### Runtime selection and fallback

Lynxtron Go classifies a project from the project root, not from the presence
of a `dist/` directory. The only precompiled short path is all of the following:

1. `package.json` declares `showcase` (the project is a released case);
2. `.lynxtron-release.json` verifies against the current source tree;
3. the requested target exists in `dist_precompiled/` and its complete file
   list, required files, and artifact hash verify.

If any condition is false, the project follows the ordinary source path:
install dependencies when required, run `npm run build`, validate
`dist/<target>`, and launch it. This is not a special "force rebuild when an old
dist exists" rule: `dist/` is simply source-build output and is never an input
to classification. Blank, Gist, Custom, modified cases, and cases whose
artifact cannot be opened all share this source path.

Source-path commands use `node` and `npm` resolved from the app's inherited
`PATH`. Lynxtron Go does not run the Lynxtron executable in Node mode, search
version-manager directories, or silently select another installed Node. Before
install/build it reads `engines.node` from the project's installed
`@lynx-js/lynxtron/package.json` (falling back to the Lynxtron package bundled
with Go), checks the current `node --version` against that published contract,
and reports both values on mismatch. Lynxtron owns the compatibility range;
Go must not maintain an additional hard-coded allow/deny list.

The runtime follows this order:

| Source hash | Precompiled artifact | Result |
|---|---|---|
| matches | file list, required files, and artifact hash all match | run `dist_precompiled/<target>` |
| matches | missing, unavailable, incomplete, or hash mismatch | install/build source and run `dist/<target>` |
| differs | any state | build the edited source and run `dist/<target>` |

`dist/` is only a local build candidate. It must never be accepted as the
official precompiled artifact, and a local build must never write into
`dist_precompiled/`. Conversely, a verified precompiled run must not load files
from `dist/`.

### Editable project format

Every editable Lynxtron Go project uses the complete starter layout:

```text
package.json
lynx.config.ts
rspack.config.ts
src/app/index.tsx
src/app/App.tsx
src/app/App.css
src/app/tsconfig.json
src/main/desktop/main.ts
src/main/desktop/tsconfig.json
```

The installer-bundled Hello case is the canonical starter source. A new Blank
project copies that complete source into `~/.lynxtron-go/projects/`, removes
the case identity, release manifest, `dist_precompiled/`, generated output and
dependency directories, and then behaves as an ordinary source project. Gists
use the same project format; the retired five-file Gist shape is migrated once
on import. No code path materializes editor files directly into a temporary
`dist/desktop`, and renderer code never decides between precompiled and source
execution.

### Installer-bundled showcases

A standard showcase may set `showcase.distribution` to `"builtin"`. It still
uses the exact release artifact format above: source, `.lynxtron-release.json`,
and `dist_precompiled/` are packed into a tgz. The only difference is transport:

- the regular `scripts/pack-showcases.mjs` command excludes built-in showcases
  from GitHub Release assets;
- `scripts/pack-showcases.mjs --builtin` builds only those showcases and stages
  their tgz files in the Lynxtron Go installer;
- the app resolves `builtin-showcase://<name>` to that staged tgz and then uses
  the normal CLI fetch, cache, hash verification, edit, build, and run paths.

Built-in artifact filenames include the installer tag. Because the CLI cache
key includes the physical file URL, installing a new formal or branch build
invalidates the previously extracted built-in workspace. The installed tgz is
read-only; user edits happen only in the materialized workspace under
`~/.lynxtron-go/showcases/`.

`@lynxtron-examples/hello-lynxtron` is the offline starter that exercises this
mode. It is not an in-memory Fiddle template and is not uploaded as a standalone
Release asset.

The format and decision matrix are enforced by the CLI release-format tests:

```bash
pnpm --dir packages/cli test
```

## E2E Testing with Local Registry

To test the dist distribution flow locally, use the local registry script.

This validates the same product promise that preview is meant to protect:

- showcases are packed with verified `dist_precompiled/` artifacts
- Lynxtron GO can consume them
- the user does not need to manually rebuild showcase source code just to preview them

Use the local registry script for that flow:

```bash
# From monorepo root — runs the full pipeline
./scripts/local-registry.sh auto

# Or start registry manually for interactive testing
./scripts/local-registry.sh start

# Then manually fetch/build/run
LYNXTRON_WORKSPACE=/tmp/lynxtron-e2e \
GH_TOKEN=$(gh auth token) \
  node packages/cli/dist/index.js fetch 'https://github.com/...'

# Stop when done
./scripts/local-registry.sh stop
```

## Release

Releases are driven by [Changesets](https://github.com/changesets/changesets) and
GitHub Actions. There is no manual `npm publish` or hand-cut tag.

### 1. Add a changeset with your change

When your PR changes anything that should trigger a version bump, add a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a bump level (`patch` / `minor` / `major`), then
commit the generated `.changeset/*.md` file. CI checks (`changeset status`) fail a
PR that changes source without a changeset.

Note: showcases and `lynxtron-go` are `private`, but `.changeset/config.json` sets
`privatePackages.version: true`, so they still get versioned and changelogged —
they just are not published to npm.

### 2. Merge to `main` → "Version Packages" PR

On push to `main`, the Release workflow (`.github/workflows/release.yml`) opens or
updates a **"Version Packages"** PR that bumps versions and writes `CHANGELOG.md`
files from the pending changesets.

### 3. Merge the "Version Packages" PR → publish

Merging that PR triggers publishing:

- **npm** — the public `@lynxtron-examples/*` packages are published to the npm
  registry via `changeset publish` using npm **OIDC trusted publishing** (no
  long-lived `NPM_TOKEN`). `@lynxtron-examples/cli` is `private: true` — it is
  bundled inside Lynxtron GO at build time and is not published to npm.
- **GitHub Release** — a `lynxtron-go-v<version>` release is created with:
  - Lynxtron GO installers: `*.dmg` (macOS) and `*-Setup.exe` (Windows), built via
    `lynxtron-builder`.
  - Every publishable showcase (a package with `showcase` metadata) packed as a
    `.tgz` containing source, `.lynxtron-release.json`, and `dist_precompiled/`.
    It is built on the macOS runner because native `.node` addons are
    host-platform specific. Standalone cases without that metadata, such as
    `codex-demo`, are not included in release artifacts.

Native artifacts (installers + showcase tarballs) are built on their matching OS
runner. The npm publish requires each `@lynxtron-examples/*` package on npmjs
to have an OIDC trusted publisher configured, pointing at this repository's
`Release` workflow (`.github/workflows/release.yml`).

### Building release artifacts locally

```bash
# Pack every publishable showcase into dist/showcase-artifacts/*.tgz
node scripts/pack-showcases.mjs

# Build the Lynxtron GO installer for the current platform
pnpm --dir lynxtron-go run pack        # macOS dmg
pnpm --dir lynxtron-go run pack:win    # Windows nsis
```

## Adding Business Dependencies

Add your own dependencies to `package.json` as usual:

```json
{
  "dependencies": {
    "some-library": "^1.0.0"
  }
}
```

Core Lynx dependencies (`@lynx-js/*`) and build tools (`@lynxtron-examples/config`) are managed at the monorepo level — don't change their versions without coordinating.

## Showcase Metadata

The `showcase` field in `package.json` is used for:
- **Lynxtron GO UI** — name, description, tags shown in the showcase list
- **Registry generation** — `pnpm run generate-registry` reads this field to produce `showcase-registry.json`
- **Compatibility checks** — `minToolchainVersion` is compared against the user's workspace

## Checklist

Before submitting a showcase:

- [ ] `pnpm run build` produces a runnable `dist/desktop/`
- [ ] `lynxtron ./dist/desktop` launches successfully
- [ ] `node scripts/pack-showcases.mjs` produces tarballs with `.lynxtron-release.json` and `dist_precompiled/`, without `dist/` or `output/`
- [ ] Public showcase packing does not produce a Hello artifact; `node scripts/pack-showcases.mjs --builtin --out lynxtron-go/resources/builtin-showcases` produces exactly one versioned Hello tgz
- [ ] The built-in Hello tgz contains `.lynxtron-release.json` and `dist_precompiled/desktop/main.lynx.bundle`
- [ ] The built-in Hello tgz references a published config version and its Rspack config does not import workspace-only package subpaths
- [ ] Project run matrix passes: unchanged case uses `dist_precompiled`; modified case, corrupt/missing artifact, custom, and modified custom build and run from `dist`
- [ ] `showcase` field in `package.json` has description and tags
- [ ] `lynx.config.ts` uses `@lynxtron-examples/config`
- [ ] No HTML elements — only Lynx built-in elements (`<view>`, `<text>`, etc.)
- [ ] No DOM/BOM APIs — use `NativeModules.bridge` for host interactions
- [ ] Run `pnpm run generate-registry` to update `showcase-registry.json`
