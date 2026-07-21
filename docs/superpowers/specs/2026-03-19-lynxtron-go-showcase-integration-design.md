# Lynxtron GO — Showcase Integration Design

## Overview

Add showcase management capabilities to Lynxtron GO's UI: fetch showcases by URL, browse their source code, and run them as independent desktop windows. This bridges the CLI tool with the IDE shell.

## Core Decisions

| Decision | Choice |
|----------|--------|
| URL input | Quick Picker command mode (`>`) + URL scheme |
| Post-fetch behavior | Auto-open showcase source directory in file tree |
| Run trigger | StatusBar button + Quick Picker command |
| Build trigger | Not in v1 scope (TODO) |
| CLI integration | preload.ts exposes showcase API, spawns CLI as child process |

## 1. Quick Picker Command System

Extend the existing Quick Picker (Cmd+P) with a VS Code-style prefix system:

| Prefix | Mode | Status |
|--------|------|--------|
| (none) | File search | Existing — fuzzy file search |
| `>` | Command palette | New — execute actions |
| `@` | Symbol jump | TODO — future |

### v1 Commands (`>` mode)

| Command | Action |
|---------|--------|
| `> Open Showcase (URL)` | Prompt for URL → CLI fetch → auto-open source directory |
| `> Run Showcase` | Run current showcase (`lynxtron ./dist/desktop`) |
| `> Open Folder` | Existing feature, moved into command mode |

### TODO Commands (not in v1)

- `> Build Showcase` — execute `rspeedy build && rspack build`
- `> Dev Showcase` — start watch mode with hot reload
- `> List Showcases` — show downloaded showcases
- `> Install Dependencies` — run `pnpm install` in current project

### Architecture

Commands are registered in a central registry, making it easy to add new ones:

```typescript
interface Command {
  id: string;
  label: string;
  keybinding?: string; // e.g. 'Cmd+Shift+O'
  execute: () => void | Promise<void>;
  when?: () => boolean; // conditional visibility
}

const commands: Command[] = [
  {
    id: 'showcase.open',
    label: 'Open Showcase (URL)',
    execute: async () => { /* prompt for URL, call fetch */ },
  },
  {
    id: 'showcase.run',
    label: 'Run Showcase',
    execute: async () => { /* call run */ },
    when: () => isShowcaseProject(), // only show when in a showcase directory
  },
  {
    id: 'folder.open',
    label: 'Open Folder',
    keybinding: 'Cmd+Shift+O',
    execute: () => { /* existing openFolder logic */ },
  },
];
```

When user types `>` in Quick Picker, switch from file search to command list with fuzzy filtering. Deleting the `>` character reverts to file search mode.

## 2. StatusBar Run Button

Add a "Run" button to the StatusBar (right side). Clicking it executes `> Run Showcase`.

- **Visible when**: current open folder has `dist/desktop/main.js` (built showcase)
- **Disabled/hidden when**: not a showcase project or not built
- Detection: read `package.json` for `showcase` field AND check `dist/desktop/main.js` exists
- Note: the existing `HIDDEN` set in `store.ts` filters out `dist/` from the file tree. This is fine — the Run button detection reads the filesystem directly, bypassing the tree filter.

## 3. URL Scheme

Register `lynxtron://` protocol handler:

```
lynxtron://open-showcase?url=https://github.com/user/repo/tree/main/showcases/counter
```

When the OS opens this URL:
1. Lynxtron GO receives the URL via protocol handler
2. Extracts the `url` parameter
3. Executes the same flow as `> Open Showcase (URL)`: CLI fetch → auto-open source directory

**Registration**: Add `CFBundleURLSchemes` in `electron-builder.yml` for macOS. In `main.ts`, listen for the URL via Lynxtron's app event API (likely `app.on('open-url', ...)` — needs verification against `@lynx-js/lynxtron` API). If the API differs from Electron, investigate and adapt. Mark as spike if needed.

## 4. CLI Bridge (preload layer)

New `showcase` namespace in preload.ts, calling CLI as child process:

```typescript
// In preload.ts
contextBridge.exposeInLynxBTS({
  // ... existing APIs (fs, config, ls, pty, utils)

  showcase: {
    // Fetch a showcase by URL. Returns the local path on success, throws on failure.
    // Progress is not streamed in v1 — call blocks until complete.
    // StatusBar shows "Fetching showcase..." during the operation.
    fetch(url: string): string, // returns showcase path synchronously (blocking call in BTS thread)

    // Run a showcase by name (as known to the CLI workspace).
    // The preload extracts the showcase name from the current rootPath.
    run(name: string): number, // returns pid

    // List downloaded showcases
    list(): Array<{ name: string; description: string; local: boolean }>,

    // Check if a directory is a showcase project (has showcase field in package.json)
    isShowcase(dirPath: string): boolean,

    // Check if a showcase has been built (dist/desktop/main.js exists)
    isBuilt(dirPath: string): boolean,
  },
});
```

**Key design notes:**
- All APIs are **synchronous** from the BTS thread perspective (no callbacks across the bridge). This matches the existing pattern in preload.ts (e.g., `fs.readFile`, `config.get`).
- The `fetch` call blocks while the CLI process runs (download + install). This is acceptable because it runs in the Lynx Background Thread, not the UI thread. The UI should show a "Fetching..." status message before calling and update after.
- `run` spawns the process and returns immediately with the pid. The spawned `lynxtron` process is tracked; cleanup on IDE exit kills child processes (same pattern as extension host).

### Implementation: `callCliSync`

```typescript
import { execSync } from 'child_process';

function callCliSync(args: string[]): any[] {
  const cliPath = require.resolve('@lynxtron-showcases/cli/dist/index.js');
  const result = execSync(
    `node ${cliPath} ${args.join(' ')}`,
    {
      env: { ...process.env, LYNXTRON_WORKSPACE: getWorkspacePath() },
      encoding: 'utf-8',
      timeout: 300000, // 5min timeout for fetch+install
    }
  );
  // Parse NDJSON lines from stdout
  return result.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}
```

For `run`, use `spawn` (non-blocking) instead of `execSync`:

```typescript
import { spawn } from 'child_process';

const runningProcesses: Map<string, ChildProcess> = new Map();

function runShowcase(name: string): number {
  const events = callCliSync(['list']);
  // ... resolve showcase path from name
  const distPath = path.join(showcasePath, 'dist', 'desktop');
  const child = spawn('lynxtron', [distPath], { stdio: 'ignore', detached: false });
  runningProcesses.set(name, child);
  child.on('close', () => runningProcesses.delete(name));
  return child.pid ?? 0;
}

// Cleanup on exit
process.on('exit', () => {
  for (const [, child] of runningProcesses) {
    child.kill();
  }
});
```

### `isShowcase` and `isBuilt` (pure filesystem checks, no CLI)

```typescript
function isShowcase(dirPath: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
    return !!pkg.showcase;
  } catch { return false; }
}

function isBuilt(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, 'dist', 'desktop', 'main.js'));
}
```

## 5. Data Flow

### Fetch + Browse flow

```
User input (Quick Picker ">" or URL Scheme)
  │
  ▼
QuickPicker: prompt for showcase URL
  │
  ▼
UI sets StatusBar text: "Fetching showcase..."
  │
  ▼
NativeModules.nodejs.exposed.showcase.fetch(url)
  │  (blocks in BTS thread while CLI runs)
  │  preload: execSync('node cli fetch <url>')
  │  CLI stdout (NDJSON): fetch-start → install-start → install-success → fetch-success
  │  CLI stderr: human-readable progress (not captured in v1)
  ▼
Returns showcase path
  │
  ▼
UI calls openFolder(showcasePath)
  │
  ▼
Sidebar displays source file tree, StatusBar clears
```

### Run flow

```
User clicks StatusBar "Run" button (or "> Run Showcase")
  │
  ▼
UI reads current rootPath, extracts showcase name
  │
  ▼
NativeModules.nodejs.exposed.showcase.run(name)
  │
  ▼
preload spawns: lynxtron <showcasePath>/dist/desktop
  │  (non-blocking, returns pid immediately)
  ▼
Independent Lynxtron window opens with showcase app
```

## 6. Error Handling (v1 minimal)

| Scenario | Behavior |
|----------|----------|
| Fetch fails (network, invalid URL, pnpm install error) | `fetch()` throws; UI catches, shows error in StatusBar: "Fetch failed: {message}" |
| `run` on unbuilt showcase | `isBuilt()` returns false; Run button hidden; command shows StatusBar: "Showcase not built" |
| `lynxtron` binary not found | `run()` spawn fails; UI shows StatusBar: "Lynxtron binary not found" |
| CLI not installed | `require.resolve` throws; UI shows StatusBar: "CLI not found" |

## 7. UI Changes Summary

| Component | Change |
|-----------|--------|
| **QuickPicker** | Add `>` prefix mode for command palette; command registry; revert to file search on `>` deletion |
| **StatusBar** | Add "Run" button (right side), visible for built showcase projects; status messages during fetch |
| **App.tsx** | Wire showcase.fetch → openFolder; showcase.run; URL scheme handler; command execution |
| **preload.ts** | Add `showcase` namespace with fetch/run/list/isShowcase/isBuilt APIs |
| **main.ts** | Register URL scheme handler, forward to UI via global event; track/cleanup spawned processes |

## 8. TODO (future scope)

- `> Build Showcase` command — trigger `rspeedy build && rspack build`
- `> Dev Showcase` command — start watch mode + auto-restart
- `@` symbol jump mode in Quick Picker
- Showcase gallery/list panel in ActivityBar
- Progress indicator during fetch (stream NDJSON events to UI via polling or global events)
- Richer error handling UI (toast notifications, error panel)
- Keyboard shortcut bindings for commands (centralize in command registry)
