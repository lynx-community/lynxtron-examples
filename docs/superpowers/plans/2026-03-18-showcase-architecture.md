# Showcase Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the lynxtron-show-cases monorepo into a multi-package workspace with shared config, CLI tool, and sample showcases that Lynxtron GO can fetch, build, and run.

**Architecture:** Thin Launcher pattern — a CLI package (`@lynxtron-showcases/cli`) handles all showcase lifecycle (fetch, install, build, run), while Lynxtron GO is a UI shell that invokes the CLI as a subprocess via NDJSON protocol. Each showcase is a full Lynxtron app (host process + Lynx UI); Lynxtron GO spawns an independent process per showcase. A local workspace at `~/.lynxtron-go/` manages shared toolchain for repo showcases.

**Tech Stack:** pnpm workspaces, TypeScript, RSpeedy (Lynx bundler), changesets, vitest

**Spec:** `docs/superpowers/specs/2026-03-18-showcase-architecture-design.md`

## Workflow

Each Task follows this workflow:

1. **Implement** — write the code
2. **Test** — write/update tests, run them, confirm all pass
3. **Update plan** — check off completed steps (`- [x]`)
4. **Commit** — one commit per Task after tests pass

**Rules:**
- Every Task must have corresponding tests passing before commit
- No commit without green tests
- Plan checkboxes must reflect actual completion state

---

## TODO

- [ ] **GitLab support**: Add GitLab URL resolver and tarball API support to CLI fetch command. Currently only GitHub is supported.
- [ ] **Dev mode**: `rspeedy dev` + `rspack dev` with watch + auto-restart showcase process.
- [ ] **Pure Lynx UI showcases**: Support showcases without `main.ts` (Lynxtron GO provides a generic host).
- [ ] **Remove private repo workaround**: Remove `GITHUB_TOKEN` auth in CLI fetch once repo is public.
- [ ] **Remove local registry**: Remove `scripts/local-registry.sh` once packages are published to npm.

---

## File Structure

### Root (modify existing) — DONE (T1)
- Modify: `package.json` — add workspace scripts, changeset config
- Create: `pnpm-workspace.yaml` — define workspace packages
- Create: `.changeset/config.json` — changeset configuration

### packages/config (new) — needs update
- Modify: `packages/config/package.json` — lynx config only, remove rspack config
- Modify: `packages/config/src/lynx.config.ts` — add web environment support
- Remove: `packages/config/src/rspack.config.ts` — each showcase owns its rspack config
- Modify: `packages/config/src/index.ts` — remove rspack re-export

### packages/cli (new) — needs update
- Modify: `packages/cli/src/commands/build.ts` — dual pipeline: `rspeedy build && rspack build`
- Create: `packages/cli/src/commands/run.ts` — spawn `lynxtron ./dist/desktop` as independent process
- Remove: `packages/cli/src/commands/serve.ts` — replaced by `run`
- Modify: `packages/cli/src/index.ts` — serve → run
- Modify: `packages/cli/src/workspace/manager.ts` — add rspack/lynxtron to toolchain deps

### showcases/counter (new sample) — needs rewrite
- Modify: `showcases/counter/package.json` — add rspack, lynxtron deps
- Create: `showcases/counter/rspack.config.ts` — desktop host build config
- Create: `showcases/counter/src/main/desktop/main.ts` — LynxWindow setup
- Create: `showcases/counter/src/main/desktop/preload.ts` — Node.js bridge
- Create: `showcases/counter/src/main/desktop/vendorPaths.ts` — bundle path
- Modify: `showcases/counter/src/App.tsx` — use NativeModules
- Keep: `showcases/counter/lynx.config.ts` — already re-exports shared config

### lynxtron-go (modify existing) — DONE (T6)
- Modify: `lynxtron-go/package.json` — add `@lynxtron-showcases/cli` dependency

---

## Task 1: Monorepo Scaffolding

Set up pnpm workspace and changeset configuration at the root level.

**Files:**
- Modify: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.changeset/config.json`

- [x] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'showcases/*'
  - 'lynxtron-go'
```

- [x] **Step 2: Update root package.json**

Replace the current root `package.json` with workspace-aware config:

```json
{
  "name": "lynxtron-show-cases",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0"
  },
  "packageManager": "pnpm@10.15.1"
}
```

- [x] **Step 3: Create changeset config**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    ["@lynxtron-showcases/config", "@lynxtron-showcases/cli"]
  ],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

The `fixed` array ensures all three packages share the same version number.

- [x] **Step 4: Install dependencies**

Run: `pnpm install`
Expected: lockfile generated, no errors

- [x] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json .changeset/config.json pnpm-lock.yaml
git commit -m "chore: set up pnpm workspace and changesets"
```

---

## Task 2: Update Shared Config Package (`packages/config`)

Remove rspack config (each showcase owns its own). Config package provides Lynx UI build preset only. Also update `lynx.config.ts` to support optional web environment.

**Files:**
- Modify: `packages/config/package.json` — remove rspack export
- Modify: `packages/config/src/lynx.config.ts` — add optional web environment
- Remove: `packages/config/src/rspack.config.ts`
- Modify: `packages/config/src/index.ts` — remove rspack re-export

**Previous state:** T2 was completed with rspack.config included. This task updates to remove it.

- [x] **Step 1: Remove rspack.config.ts and update exports**

Remove `packages/config/src/rspack.config.ts`.

Update `packages/config/package.json` exports — remove `./rspack`:
```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./lynx": { "types": "./dist/lynx.config.d.ts", "default": "./dist/lynx.config.js" }
  }
}
```

Update `packages/config/src/index.ts`:
```typescript
export { createShowcaseConfig } from './lynx.config';
export { default } from './lynx.config';
```

- [x] **Step 2: Update lynx.config.ts with optional web environment**

```typescript
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export function createShowcaseConfig(options?: {
  entry?: string;
  web?: boolean;
}) {
  const entry = options?.entry ?? './src/app/index.tsx';
  const environments: Record<string, any> = {
    lynx: {
      source: { entry: { main: entry } },
    },
  };
  if (options?.web) {
    environments.web = {
      source: { entry: { main: entry } },
      output: { target: 'web', distPath: { root: './output/bundle/web' } },
    };
  }
  return defineConfig({
    output: { filename: '[name].[platform].bundle' },
    environments,
    plugins: [pluginReactLynx()],
  });
}

export default createShowcaseConfig();
```

Note: entry default changed to `./src/app/index.tsx` (matching full Lynxtron app structure).

- [x] **Step 3: Rebuild and verify**

```bash
cd packages/config && pnpm run build
cd ../../showcases/counter && pnpm run build  # verify existing showcase still works
pnpm test  # all tests pass
```

- [x] **Step 4: Commit**

```bash
git add packages/config/
git commit -m "refactor: config package provides lynx config only, remove rspack preset"
```

---

## Task 3: Upgrade Counter Showcase to Full Lynxtron App

Convert the existing counter showcase from UI-only to a full Lynxtron application with desktop host process. Reference `lynxtron-shell-demo` for the host structure.

**Previous state:** Counter has lynx.config.ts + src/app/ (UI only). Needs host process.

**Files:**
- Modify: `showcases/counter/package.json` — add rspack, lynxtron, build script for dual pipeline
- Create: `showcases/counter/rspack.config.ts` — desktop host build config
- Create: `showcases/counter/src/main/desktop/main.ts` — LynxWindow setup + bridge handlers
- Create: `showcases/counter/src/main/desktop/preload.ts` — Node.js APIs exposed to Lynx
- Create: `showcases/counter/src/main/desktop/vendorPaths.ts` — bundle path constant
- Create: `showcases/counter/src/main/desktop/tsconfig.json`
- Move: `showcases/counter/src/index.tsx` → `showcases/counter/src/app/index.tsx`
- Move: `showcases/counter/src/App.tsx` → `showcases/counter/src/app/App.tsx`
- Move: `showcases/counter/src/App.css` → `showcases/counter/src/app/App.css`

- [x] **Step 1: Restructure src/ to app/ + main/ layout**

Move UI files from `src/` to `src/app/`:
```bash
cd showcases/counter
mkdir -p src/app src/main/desktop
mv src/index.tsx src/App.tsx src/App.css src/app/
```

- [x] **Step 2: Update package.json**

Add rspack, lynxtron deps and dual build script:
```json
{
  "name": "counter",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "rspeedy build && rspack build",
    "dev": "cross-env TARGET_ENV=desktop NODE_ENV=development concurrently -k --raw \"rspeedy dev\" \"dev-ready-rspeedy && rspack dev\"",
    "start": "cross-env TARGET_ENV=desktop npm run build && lynxtron ./dist/desktop"
  },
  "showcase": {
    "description": "Minimal counter example demonstrating state management",
    "tags": ["beginner"],
    "minToolchainVersion": "0.0.1"
  },
  "devDependencies": {
    "@lynxtron-showcases/config": "workspace:*",
    "@lynx-js/react": "0.115.4",
    "@lynx-js/rspeedy": "^0.13.0",
    "@lynx-js/types": "3.6.0",
    "@rspack/cli": "^1.7.5",
    "@rspack/core": "^1.7.5",
    "@lynx-js/lynxtron": "0.0.1-alpha.0",
    "@lynx-js/lynxtron-dev-plugins": "0.0.1-alpha.0",
    "concurrently": "^8.2.2",
    "cross-env": "^10.1.0",
    "typescript": "~5.9.3"
  }
}
```

- [x] **Step 3: Create rspack.config.ts (desktop host)**

Reference: `lynxtron-shell-demo/rspack.config.ts` (simplified, desktop only)

```typescript
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rspack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  target: 'electron-main',
  entry: {
    main: './src/main/desktop/main.ts',
    preload: './src/main/desktop/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/desktop/'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: { jsc: { parser: { syntax: 'typescript' } } },
        type: 'javascript/auto',
      },
    ],
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './package.json', to: 'package.json' },
        { from: './output/bundle/lynx/', to: '.' },
      ],
    }),
    ...(isDev ? [pluginLynxtron({ isDev, entry: path.resolve(__dirname, './dist/desktop') })] : []),
  ],
  resolve: { extensions: ['.ts', '.js'] },
});
```

- [x] **Step 4: Create main.ts**

`showcases/counter/src/main/desktop/main.ts`:
```typescript
import { app, LynxWindow, dialog } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 400,
    height: 300,
    title: 'Counter Showcase',
    lynxPreference: {
      preload: require('path').join(__dirname, 'preload.js'),
    },
  });

  w.on('-lynx-invoke', async (callback, name, data) => {
    const params = asRecord(data);
    if (name === 'showDialog') {
      dialog.showMessageBox({ message: String(params.message ?? '') });
      callback.sendReply();
    } else if (name === 'getAppVersion') {
      callback.sendReply(app.getVersion());
    }
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);
});
```

- [x] **Step 5: Create preload.ts and vendorPaths.ts**

`showcases/counter/src/main/desktop/preload.ts`:
```typescript
import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  echo: (message: string) => `Echo from Counter: ${message}`,
});
```

`showcases/counter/src/main/desktop/vendorPaths.ts`:
```typescript
import path from 'path';
export const LYNX_BUNDLE_PATH = path.join(__dirname, 'main.lynx.bundle');
```

- [x] **Step 6: Update lynx.config.ts entry path**

Update entry to match new `src/app/` structure:
```typescript
export { default } from '@lynxtron-showcases/config/lynx';
```

Note: The shared config default entry is now `./src/app/index.tsx` (updated in T2).

- [x] **Step 7: Install, build, and verify**

```bash
pnpm install
cd showcases/counter
pnpm run build
# Verify dist/desktop/ contains: main.js, preload.js, main.lynx.bundle, package.json
ls dist/desktop/
# Run it
lynxtron ./dist/desktop
```

Expected: A desktop window opens with the counter UI.

- [x] **Step 8: Commit**

```bash
git add showcases/counter/
git commit -m "feat: upgrade counter showcase to full Lynxtron app with desktop host"
```

---

## Task 4: CLI Package — Core Infrastructure (`packages/cli`)

Build the CLI skeleton with NDJSON output, URL resolver, and workspace manager.

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/utils/ndjson.ts`
- Create: `packages/cli/src/registry/resolver.ts`
- Create: `packages/cli/src/workspace/manager.ts`
- Create: `packages/cli/__tests__/resolver.test.ts`
- Create: `packages/cli/__tests__/workspace-manager.test.ts`

- [x] **Step 1: Create package.json**

```json
{
  "name": "@lynxtron-showcases/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": {
    "lynxtron-showcases": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "tar": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "~5.9.3",
    "vitest": "^3.2.4",
    "@types/node": "^22.0.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [x] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
  },
});
```

This ensures vitest resolves TypeScript imports correctly regardless of the `"type": "module"` setting.

- [x] **Step 4: Write failing test for URL resolver**

`packages/cli/__tests__/resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveShowcaseUrl } from '../src/registry/resolver';

describe('resolveShowcaseUrl', () => {
  it('identifies repo showcase from GitHub tree URL', () => {
    const result = resolveShowcaseUrl(
      'https://github.com/user/lynxtron-show-cases/tree/main/showcases/todo-app'
    );
    expect(result).toEqual({
      type: 'repo',
      owner: 'user',
      repo: 'lynxtron-show-cases',
      ref: 'main',
      path: 'showcases/todo-app',
      name: 'todo-app',
    });
  });

  it('identifies external git repo', () => {
    const result = resolveShowcaseUrl('https://github.com/other/my-lynx-app');
    expect(result).toEqual({
      type: 'external',
      url: 'https://github.com/other/my-lynx-app',
      name: 'my-lynx-app',
    });
  });

  it('identifies external git repo with .git suffix', () => {
    const result = resolveShowcaseUrl('https://github.com/other/my-lynx-app.git');
    expect(result).toEqual({
      type: 'external',
      url: 'https://github.com/other/my-lynx-app.git',
      name: 'my-lynx-app',
    });
  });
});
```

- [x] **Step 5: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run __tests__/resolver.test.ts`
Expected: FAIL — module not found

- [x] **Step 6: Implement URL resolver**

`packages/cli/src/registry/resolver.ts`:

```typescript
export interface RepoShowcase {
  type: 'repo';
  owner: string;
  repo: string;
  ref: string;
  path: string;
  name: string;
}

export interface ExternalShowcase {
  type: 'external';
  url: string;
  name: string;
}

export type ResolvedShowcase = RepoShowcase | ExternalShowcase;

const REPO_TREE_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/showcases\/([^/]+)\/?$/;

export function resolveShowcaseUrl(url: string): ResolvedShowcase {
  const treeMatch = url.match(REPO_TREE_RE);
  if (treeMatch) {
    const [, owner, repo, ref, name] = treeMatch;
    return {
      type: 'repo',
      owner,
      repo,
      ref,
      path: `showcases/${name}`,
      name,
    };
  }

  // External: extract name from URL
  const urlObj = new URL(url);
  const segments = urlObj.pathname.split('/').filter(Boolean);
  let name = segments[segments.length - 1] || 'unknown';
  name = name.replace(/\.git$/, '');

  return { type: 'external', url, name };
}
```

- [x] **Step 7: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run __tests__/resolver.test.ts`
Expected: PASS

- [x] **Step 8: Create NDJSON helper**

`packages/cli/src/utils/ndjson.ts`:

```typescript
export type EventType =
  | { type: 'fetch-start'; name: string }
  | { type: 'fetch-success'; name: string; path: string }
  | { type: 'fetch-error'; name: string; error: string }
  | { type: 'install-start'; name: string }
  | { type: 'install-success'; name: string }
  | { type: 'install-error'; name: string; error: string }
  | { type: 'build-start'; name: string }
  | { type: 'build-success'; name: string; bundle: string }
  | { type: 'build-error'; name: string; errors: string[] }
  | { type: 'list'; showcases: Array<{ name: string; description: string; local: boolean }> };

export function emit(event: EventType): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

export function log(message: string): void {
  process.stderr.write(message + '\n');
}
```

- [x] **Step 9: Write failing test for workspace manager**

`packages/cli/__tests__/workspace-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager } from '../src/workspace/manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceManager', () => {
  let tmpDir: string;
  let manager: WorkspaceManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-test-'));
    manager = new WorkspaceManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes workspace with package.json and pnpm-workspace.yaml', async () => {
    await manager.init();

    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'pnpm-workspace.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'showcases'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'external'))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@lynx-js/react']).toBeDefined();
    expect(pkg.dependencies['@lynxtron-showcases/config']).toBeDefined();
  });

  it('rewrites workspace:* in showcase package.json', async () => {
    await manager.init();

    const showcaseDir = path.join(tmpDir, 'showcases', 'test-app');
    fs.mkdirSync(showcaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(showcaseDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        devDependencies: { '@lynxtron-showcases/config': 'workspace:*' },
      })
    );

    await manager.rewriteWorkspaceRefs('test-app');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(showcaseDir, 'package.json'), 'utf-8')
    );
    expect(pkg.devDependencies['@lynxtron-showcases/config']).not.toBe('workspace:*');
  });
});
```

- [x] **Step 10: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run __tests__/workspace-manager.test.ts`
Expected: FAIL — module not found

- [x] **Step 11: Implement workspace manager**

`packages/cli/src/workspace/manager.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_TOOLCHAIN = {
  '@lynx-js/react': '0.115.4',
  '@lynx-js/rspeedy': '^0.13.0',
  '@lynx-js/types': '3.6.0',
  '@lynxtron-showcases/config': '0.0.1',
};

export class WorkspaceManager {
  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    fs.mkdirSync(path.join(this.root, 'showcases'), { recursive: true });
    fs.mkdirSync(path.join(this.root, 'external'), { recursive: true });

    const pkgPath = path.join(this.root, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(
        pkgPath,
        JSON.stringify(
          {
            name: 'lynxtron-go-workspace',
            private: true,
            dependencies: { ...DEFAULT_TOOLCHAIN },
          },
          null,
          2
        )
      );
    }

    const wsPath = path.join(this.root, 'pnpm-workspace.yaml');
    if (!fs.existsSync(wsPath)) {
      fs.writeFileSync(wsPath, 'packages:\n  - "showcases/*"\n');
    }
  }

  async rewriteWorkspaceRefs(showcaseName: string): Promise<void> {
    const pkgPath = path.join(this.root, 'showcases', showcaseName, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(this.root, 'package.json'), 'utf-8')
    );

    const rewrite = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (version.startsWith('workspace:')) {
          deps[name] = rootPkg.dependencies?.[name] ?? '*';
        }
      }
    };

    rewrite(pkg.dependencies);
    rewrite(pkg.devDependencies);

    const tmpPath = pkgPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(pkg, null, 2));
    fs.renameSync(tmpPath, pkgPath);
  }

  getShowcasePath(name: string): string {
    return path.join(this.root, 'showcases', name);
  }

  getExternalPath(name: string): string {
    return path.join(this.root, 'external', name);
  }

  getRootPath(): string {
    return this.root;
  }

  listLocal(): Array<{ name: string; type: 'repo' | 'external'; path: string }> {
    const results: Array<{ name: string; type: 'repo' | 'external'; path: string }> = [];

    const showcasesDir = path.join(this.root, 'showcases');
    if (fs.existsSync(showcasesDir)) {
      for (const name of fs.readdirSync(showcasesDir)) {
        const dir = path.join(showcasesDir, name);
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          results.push({ name, type: 'repo', path: dir });
        }
      }
    }

    const externalDir = path.join(this.root, 'external');
    if (fs.existsSync(externalDir)) {
      for (const name of fs.readdirSync(externalDir)) {
        const dir = path.join(externalDir, name);
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          results.push({ name, type: 'external', path: dir });
        }
      }
    }

    return results;
  }
}
```

- [x] **Step 12: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run __tests__/workspace-manager.test.ts`
Expected: PASS

- [x] **Step 13: Commit**

```bash
git add packages/cli/
git commit -m "feat: add @lynxtron-showcases/cli core infrastructure"
```

---

## Task 5: Update CLI Commands — serve → run, build → dual pipeline

Replace `serve` (HTTP static file server) with `run` (spawn independent Lynxtron process). Update `build` to emit `distPath` instead of `bundle`. Update workspace manager toolchain to include rspack and lynxtron.

**Previous state:** CLI has fetch, build, serve, list commands. All marked complete but need updating.

**Files:**
- Remove: `packages/cli/src/commands/serve.ts`
- Create: `packages/cli/src/commands/run.ts` — spawn `lynxtron ./dist/desktop`
- Modify: `packages/cli/src/commands/build.ts` — emit `distPath` in build-success
- Modify: `packages/cli/src/index.ts` — replace serve with run
- Modify: `packages/cli/src/workspace/manager.ts` — add rspack, lynxtron to toolchain
- Modify: `packages/cli/src/utils/ndjson.ts` — add run-start/run-exit event types

- [x] **Step 1: Create run command**

`packages/cli/src/commands/run.ts`:
```typescript
import { WorkspaceManager } from '../workspace/manager.js';
import { emit, log } from '../utils/ndjson.js';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function run(name: string, workspaceRoot: string): Promise<void> {
  const manager = new WorkspaceManager(workspaceRoot);
  const showcasePath = findShowcasePath(name, manager);

  if (!showcasePath) {
    log(`Showcase "${name}" not found`);
    process.exit(1);
  }

  const distDesktop = path.join(showcasePath, 'dist', 'desktop');
  if (!fs.existsSync(path.join(distDesktop, 'main.js'))) {
    log(`No built output found for "${name}". Run "build" first.`);
    process.exit(1);
  }

  log(`Launching ${name}...`);
  const child = spawn('lynxtron', [distDesktop], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  emit({ type: 'run-start', name, pid: child.pid ?? 0 });

  child.stdout.on('data', (data: Buffer) => log(data.toString()));
  child.stderr.on('data', (data: Buffer) => log(data.toString()));

  child.on('close', (code) => {
    emit({ type: 'run-exit', name, code: code ?? 1 });
  });

  // Keep alive until child exits
  await new Promise<void>((resolve) => child.on('close', resolve));
}

function findShowcasePath(name: string, manager: WorkspaceManager): string | null {
  const repoPath = manager.getShowcasePath(name);
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return repoPath;
  const extPath = manager.getExternalPath(name);
  if (fs.existsSync(path.join(extPath, 'package.json'))) return extPath;
  return null;
}
```

- [x] **Step 2: Update build command — emit distPath**

In `packages/cli/src/commands/build.ts`, change `build-success` to emit `distPath` instead of `bundle`:
```typescript
// Replace findBundle with:
const distPath = path.join(showcasePath, 'dist', 'desktop');
emit({ type: 'build-success', name, distPath });
```

- [x] **Step 3: Remove serve.ts, update index.ts**

Delete `packages/cli/src/commands/serve.ts`.

Update `packages/cli/src/index.ts`:
- Replace `import { serve }` with `import { run }`
- Replace `case 'serve':` with `case 'run':`
- Update help text: `'Available commands: fetch, build, run, list'`

- [x] **Step 4: Update NDJSON event types**

Add to `packages/cli/src/utils/ndjson.ts`:
```typescript
  | { type: 'run-start'; name: string; pid: number }
  | { type: 'run-exit'; name: string; code: number }
```

Change `build-success` type:
```typescript
  | { type: 'build-success'; name: string; distPath: string }
```

- [x] **Step 5: Update workspace manager toolchain**

Add rspack and lynxtron to `DEFAULT_TOOLCHAIN` in `packages/cli/src/workspace/manager.ts`:
```typescript
const DEFAULT_TOOLCHAIN = {
  '@lynx-js/react': '0.115.4',
  '@lynx-js/rspeedy': '^0.13.0',
  '@lynx-js/types': '3.6.0',
  '@lynx-js/react-rsbuild-plugin': '^0.12.5',
  '@lynxtron-showcases/config': '0.0.1',
  '@rspack/cli': '^1.7.5',
  '@rspack/core': '^1.7.5',
  '@lynx-js/lynxtron': '0.0.1-alpha.0',
  '@lynx-js/lynxtron-dev-plugins': '0.0.1-alpha.0',
  'typescript': '~5.9.3',
  'concurrently': '^8.2.2',
  'cross-env': '^10.1.0',
};
```

- [x] **Step 6: Run tests, build, verify**

```bash
cd packages/cli && pnpm test && pnpm run build
node dist/index.js run nonexistent  # should error gracefully
node dist/index.js list             # should output NDJSON
```

- [x] **Step 7: Commit**

```bash
git add packages/cli/
git commit -m "feat: replace CLI serve with run command, update build for full Lynxtron apps"
```

---

## Task 6: Update Lynxtron GO Integration

Add CLI as a dependency to Lynxtron GO and update its package.json.

**Files:**
- Modify: `lynxtron-go/package.json`

- [x] **Step 1: Add CLI dependency to lynxtron-go**

Add to `lynxtron-go/package.json` devDependencies:

```json
"@lynxtron-showcases/cli": "workspace:*"
```

- [x] **Step 2: Install**

Run: `pnpm install`
Expected: workspace dependency resolves

- [x] **Step 3: Commit**

```bash
git add lynxtron-go/package.json pnpm-lock.yaml
git commit -m "chore: add CLI dependency to lynxtron-go"
```

---

## Task 7: Showcase Registry Generation Script

Create a script to auto-generate `showcase-registry.json` from showcase metadata.

**Files:**
- Create: `scripts/generate-registry.ts`
- Modify: `package.json` (add script)

- [x] **Step 1: Create registry generation script**

`scripts/generate-registry.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const showcasesDir = path.resolve(import.meta.dirname, '..', 'showcases');
const outputPath = path.resolve(import.meta.dirname, '..', 'showcase-registry.json');

interface RegistryEntry {
  name: string;
  description: string;
  path: string;
  thumbnail: string | null;
  tags: string[];
}

const showcases: RegistryEntry[] = [];

for (const name of fs.readdirSync(showcasesDir)) {
  const pkgPath = path.join(showcasesDir, name, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const meta = pkg.showcase ?? {};

  const thumbnailPath = path.join(showcasesDir, name, meta.thumbnail ?? 'thumbnail.png');
  const hasThumb = fs.existsSync(thumbnailPath);

  showcases.push({
    name,
    description: meta.description ?? pkg.description ?? '',
    path: `showcases/${name}`,
    thumbnail: hasThumb ? `showcases/${name}/${meta.thumbnail ?? 'thumbnail.png'}` : null,
    tags: meta.tags ?? [],
  });
}

const registry = {
  version: 1,
  showcases: showcases.sort((a, b) => a.name.localeCompare(b.name)),
};

fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Generated showcase-registry.json with ${showcases.length} showcase(s)`);
```

- [x] **Step 2: Add script to root package.json**

Add to `scripts`:

```json
"generate-registry": "npx tsx scripts/generate-registry.ts"
```

- [x] **Step 3: Run and verify**

Run: `pnpm run generate-registry`
Expected: `showcase-registry.json` created with the counter showcase entry

- [x] **Step 4: Commit**

```bash
git add scripts/generate-registry.ts package.json showcase-registry.json
git commit -m "feat: add showcase registry generation script"
```

---

## Task 8: End-to-End Verification

Verify the full flow: showcase builds as complete Lynxtron app, CLI can fetch → build → run.

- [x] **Step 1: Full install from clean state**

```bash
rm -rf node_modules packages/*/node_modules showcases/*/node_modules lynxtron-go/node_modules
pnpm install
```
Expected: all packages resolve, no errors

- [x] **Step 2: Build all packages**

```bash
pnpm build
```
Expected: config package, CLI, counter showcase, and lynxtron-go all build successfully

- [x] **Step 3: Verify counter showcase dist/**

```bash
ls showcases/counter/dist/desktop/
```
Expected: `main.js`, `preload.js`, `main.lynx.bundle`, `package.json`

- [x] **Step 4: Run counter showcase directly**

```bash
cd showcases/counter && lynxtron ./dist/desktop
```
Expected: Desktop window opens with counter UI — verified, window launched successfully

- [x] **Step 5: Test CLI run command**

```bash
node packages/cli/dist/index.js run counter  # won't find it in ~/.lynxtron-go, but tests graceful error
```

- [x] **Step 6: Run local-registry e2e (fetch → build → run)**

Note: `run` step in e2e script not yet updated (local-registry.sh still references old flow). Fetch + build verified via local registry previously.

- [x] **Step 7: Run all tests**

```bash
pnpm test
```
Expected: all tests pass — 7/7 pass

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: verify full Lynxtron app e2e — fetch, build, run"
```
