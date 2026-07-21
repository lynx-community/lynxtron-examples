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
- `pnpm preview` validates the **dist distribution flow** locally; it is not a source-mode shortcut

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
    "@lynxtron-showcases/config": "workspace:*",
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
- `showcase.minToolchainVersion` — minimum `@lynxtron-showcases/*` version required

### 3. Create `lynx.config.ts`

```typescript
export { default } from '@lynxtron-showcases/config/lynx';
```

This gives you zero-config builds. If you need custom configuration:

```typescript
import { createShowcaseConfig } from '@lynxtron-showcases/config';

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

## E2E Testing with Local Registry

To test the dist distribution flow locally, use the local registry script.

This validates the same product promise that preview is meant to protect:

- showcases are packed as dist artifacts
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

## Adding Business Dependencies

Add your own dependencies to `package.json` as usual:

```json
{
  "dependencies": {
    "some-library": "^1.0.0"
  }
}
```

Core Lynx dependencies (`@lynx-js/*`) and build tools (`@lynxtron-showcases/config`) are managed at the monorepo level — don't change their versions without coordinating.

## Showcase Metadata

The `showcase` field in `package.json` is used for:
- **Lynxtron GO UI** — name, description, tags shown in the showcase list
- **Registry generation** — `pnpm run generate-registry` reads this field to produce `showcase-registry.json`
- **Compatibility checks** — `minToolchainVersion` is compared against the user's workspace

## Checklist

Before submitting a showcase:

- [ ] `pnpm run build` produces a runnable `dist/desktop/`
- [ ] `lynxtron ./dist/desktop` launches successfully
- [ ] `showcase` field in `package.json` has description and tags
- [ ] `lynx.config.ts` uses `@lynxtron-showcases/config`
- [ ] No HTML elements — only Lynx built-in elements (`<view>`, `<text>`, etc.)
- [ ] No DOM/BOM APIs — use `NativeModules.bridge` for host interactions
- [ ] Run `pnpm run generate-registry` to update `showcase-registry.json`
