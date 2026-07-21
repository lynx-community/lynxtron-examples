# Lynxtron GO Showcase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add showcase management to Lynxtron GO's UI — fetch by URL, browse source code, and run showcases as independent desktop windows.

**Architecture:** Quick Picker gains a `>` command palette mode. preload.ts gets a `showcase` namespace that calls CLI via `execSync`/`spawn`. StatusBar gets a Run button. All showcase operations go through the existing CLI package.

**Tech Stack:** ReactLynx, Lynxtron preload/contextBridge, @lynxtron-showcases/cli (NDJSON)

**Spec:** `docs/superpowers/specs/2026-03-19-lynxtron-go-showcase-integration-design.md`

## Workflow

Each Task follows this workflow:

1. **Implement** — write the code
2. **Test** — write/update tests, run them, confirm all pass
3. **Update plan** — check off completed steps (`- [x]`)
4. **Commit** — one commit per Task after tests pass

---

## Spec Deviations

- **URL scheme deferred**: Spec Section 3 describes `lynxtron://` protocol handler as a v1 feature. Deferred because Lynxtron's `app.on('open-url')` API needs investigation — it may not match Electron's API. Registered as TODO below.
- **`showcase.run` takes path, not name**: Spec says `run(name: string)`. Plan uses `run(showcasePath: string)` — simpler, avoids extra `list` CLI call. UI already knows the rootPath.
- **`showcase.list()` implemented but unused in v1**: Preload exposes `list()` for future `> List Showcases` command. No UI calls it in v1.

## TODO (future scope)

- [ ] `> Build Showcase` command
- [ ] `> Dev Showcase` command (watch mode)
- [ ] `> List Showcases` command (preload API ready, needs UI)
- [ ] `@` symbol jump mode in Quick Picker
- [ ] Showcase gallery panel in ActivityBar
- [ ] Progress indicator during fetch
- [ ] URL scheme (`lynxtron://`) — needs Lynxtron API investigation for `app.on('open-url')` equivalent
- [ ] Keyboard shortcut bindings in command registry

---

## File Structure

### lynxtron-go/src/app/ (UI layer)
- Create: `src/app/commands/registry.ts` — command registry (Command interface + registered commands)
- Create: `src/app/commands/showcase-commands.ts` — showcase.open + showcase.run commands
- Modify: `src/app/components/QuickPicker/QuickPicker.tsx` — add `>` prefix mode for command palette
- Modify: `src/app/components/QuickPicker/QuickPicker.css` — command item styling
- Modify: `src/app/components/StatusBar/StatusBar.tsx` — add Run button
- Modify: `src/app/components/StatusBar/StatusBar.css` — Run button styling
- Modify: `src/app/App.tsx` — wire commands, pass showcase state to StatusBar
- Modify: `src/app/store.ts` — add showcase helper types

### lynxtron-go/src/main/desktop/ (host layer)
- Modify: `src/main/desktop/preload.ts` — add `showcase` namespace (fetch/run/list/isShowcase/isBuilt)

---

## Task 1: Preload Showcase API

Add the `showcase` namespace to preload.ts. This is the bridge between UI and CLI.

**Files:**
- Modify: `lynxtron-go/src/main/desktop/preload.ts`

- [x] **Step 1: Add showcase namespace to preload**

Add after the existing `utils` namespace in `contextBridge.exposeInLynxBTS({...})`:

```typescript
showcase: {
  fetch: (url: string): string => {
    try {
      const { execFileSync } = require('child_process') as typeof import('child_process');
      const cliPath = require.resolve('@lynxtron-showcases/cli/dist/index.js');
      const wsPath = path.join(os.homedir(), '.lynxtron-go');
      // Use execFileSync (no shell) to avoid injection via user-provided URL
      const result = execFileSync(
        'node',
        [cliPath, 'fetch', url],
        {
          env: { ...process.env, LYNXTRON_WORKSPACE: wsPath },
          encoding: 'utf-8',
          timeout: 300000,
        }
      );
      const events = result.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const success = events.find((e: any) => e.type === 'fetch-success');
      if (success) return success.path;
      const error = events.find((e: any) => e.type === 'fetch-error');
      throw new Error(error?.error || 'Fetch failed');
    } catch (e: any) {
      dbg(`showcase.fetch error: ${e.message}`);
      throw e;
    }
  },

  run: (showcasePath: string): number => {
    try {
      const distDesktop = path.join(showcasePath, 'dist', 'desktop');
      if (!fs.existsSync(path.join(distDesktop, 'main.js'))) {
        throw new Error('Showcase not built. dist/desktop/main.js not found.');
      }
      const lynxtronBin = require.resolve('@lynx-js/lynxtron/cli.js');
      const child = spawn('node', [lynxtronBin, distDesktop], {
        stdio: 'ignore',
        detached: false,
        env: { ...process.env },
      });
      const pid = child.pid ?? 0;
      dbg(`showcase.run: launched pid=${pid} path=${distDesktop}`);
      // Track for cleanup
      child.on('close', (code) => {
        dbg(`showcase.run: pid=${pid} exited code=${code}`);
        runningShowcases.delete(pid);
      });
      runningShowcases.set(pid, child);
      child.unref(); // Don't block IDE exit
      return pid;
    } catch (e: any) {
      dbg(`showcase.run error: ${e.message}`);
      throw e;
    }
  },

  list: (): Array<{ name: string; description: string; local: boolean }> => {
    try {
      const { execFileSync } = require('child_process') as typeof import('child_process');
      const cliPath = require.resolve('@lynxtron-showcases/cli/dist/index.js');
      const wsPath = path.join(os.homedir(), '.lynxtron-go');
      const result = execFileSync(
        'node',
        [cliPath, 'list'],
        {
          env: { ...process.env, LYNXTRON_WORKSPACE: wsPath },
          encoding: 'utf-8',
          timeout: 10000,
        }
      );
      const events = result.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const listEvent = events.find((e: any) => e.type === 'list');
      return listEvent?.showcases ?? [];
    } catch (e: any) {
      dbg(`showcase.list error: ${e.message}`);
      return [];
    }
  },

  isShowcase: (dirPath: string): boolean => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
      return !!pkg.showcase;
    } catch { return false; }
  },

  isBuilt: (dirPath: string): boolean => {
    return fs.existsSync(path.join(dirPath, 'dist', 'desktop', 'main.js'));
  },
},
```

Also add at the top of the file (near other state declarations):

```typescript
const runningShowcases = new Map<number, ChildProcess>();
```

And add to the existing `process.on('exit', ...)` handler:

```typescript
for (const [, child] of runningShowcases) {
  try { child.kill(); } catch (_) {}
}
```

- [x] **Step 2: Rebuild and verify**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go
pnpm run build
```

Expected: builds without errors. The `showcase` namespace is now available via `NativeModules.nodejs.exposed.showcase`.

- [x] **Step 3: Run tests**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases
pnpm test
```

Expected: all existing tests pass (70 lynxtron-go + 6 CLI)

- [x] **Step 4: Commit**

```bash
git add lynxtron-go/src/main/desktop/preload.ts
git commit -m "feat(lynxtron-go): add showcase preload API (fetch/run/list/isShowcase/isBuilt)"
```

---

## Task 2: Command Registry

Create the command system that Quick Picker will use.

**Files:**
- Create: `lynxtron-go/src/app/commands/registry.ts`

- [x] **Step 1: Create command registry**

`lynxtron-go/src/app/commands/registry.ts`:

```typescript
export interface Command {
  id: string;
  label: string;
  keybinding?: string;
  execute: () => void | Promise<void>;
  when?: () => boolean;
}

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  const existing = commands.findIndex(c => c.id === cmd.id);
  if (existing >= 0) commands[existing] = cmd;
  else commands.push(cmd);
}

export function getVisibleCommands(): Command[] {
  return commands.filter(cmd => !cmd.when || cmd.when());
}

export function executeCommand(id: string): void {
  const cmd = commands.find(c => c.id === id);
  if (cmd) cmd.execute();
}

export function filterCommands(query: string): Command[] {
  const q = query.toLowerCase();
  return getVisibleCommands().filter(cmd =>
    cmd.label.toLowerCase().includes(q)
  );
}
```

- [x] **Step 2: Build and verify**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go && pnpm run build
```

- [x] **Step 3: Commit**

```bash
git add lynxtron-go/src/app/commands/
git commit -m "feat(lynxtron-go): add command registry for Quick Picker palette"
```

---

## Task 3: Quick Picker Command Palette Mode

Extend Quick Picker to support `>` prefix for command mode.

**Files:**
- Modify: `lynxtron-go/src/app/components/QuickPicker/QuickPicker.tsx`
- Modify: `lynxtron-go/src/app/components/QuickPicker/QuickPicker.css`

- [x] **Step 1: Update QuickPicker props and component**

The QuickPicker needs to handle two modes:
- File search (existing, no prefix)
- Command palette (when query starts with `>`)

Replace `lynxtron-go/src/app/components/QuickPicker/QuickPicker.tsx`:

```tsx
import './QuickPicker.css';
import { fileIcon, type TreeNode } from '../../store';
import { filterCommands, type Command } from '../../commands/registry';

interface QuickPickerProps {
  rootPath: string;
  query: string;
  filteredFiles: TreeNode[];
  onQueryChange: (value: string) => void;
  onSelect: (fullPath: string) => void;
  onClose: () => void;
}

export function QuickPicker({
  rootPath, query, filteredFiles,
  onQueryChange, onSelect, onClose,
}: QuickPickerProps) {
  const isCommandMode = query.startsWith('>');
  const commandQuery = isCommandMode ? query.slice(1).trim() : '';
  const commands = isCommandMode ? filterCommands(commandQuery) : [];

  const handleCommandSelect = (cmd: Command) => {
    onClose();
    cmd.execute();
  };

  return (
    <view className="PickerOverlay" bindtap={onClose}>
      <view className="PickerModal" catchtap={() => {}}>
        <input
          className="PickerInput"
          value={query}
          bindinput={(e: any) => onQueryChange(e.detail.value)}
          placeholder={isCommandMode ? 'Type a command\u2026' : 'Search files (type > for commands)\u2026'}
        />
        <scroll-view className="PickerResults" scroll-y>
          {isCommandMode ? (
            commands.map(cmd => (
              <view
                key={cmd.id}
                className="PickerItem PickerCommand"
                bindtap={() => handleCommandSelect(cmd)}
              >
                <text className="PickerIcon">{'\u25B6'}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{cmd.label}</text>
                  {cmd.keybinding && (
                    <text className="PickerFilePath">{cmd.keybinding}</text>
                  )}
                </view>
              </view>
            ))
          ) : (
            filteredFiles.map(f => (
              <view
                key={f.fullPath}
                className="PickerItem"
                bindtap={() => onSelect(f.fullPath)}
              >
                <text className="PickerIcon">{fileIcon(f.name)}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{f.name}</text>
                  <text className="PickerFilePath">
                    {f.fullPath.replace(rootPath + '/', '')}
                  </text>
                </view>
              </view>
            ))
          )}
        </scroll-view>
      </view>
    </view>
  );
}
```

- [x] **Step 2: Add command item styling**

Append to `lynxtron-go/src/app/components/QuickPicker/QuickPicker.css`:

```css
.PickerCommand .PickerIcon {
  color: #007aff;
}
```

- [x] **Step 3: Build and verify**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go && pnpm run build
```

- [x] **Step 4: Commit**

```bash
git add lynxtron-go/src/app/components/QuickPicker/
git commit -m "feat(lynxtron-go): Quick Picker command palette mode with > prefix"
```

---

## Task 4: StatusBar Run Button

Add a Run button to StatusBar that's visible when current folder is a built showcase.

**Files:**
- Modify: `lynxtron-go/src/app/components/StatusBar/StatusBar.tsx`
- Modify: `lynxtron-go/src/app/components/StatusBar/StatusBar.css`

- [x] **Step 1: Update StatusBar component**

Replace `lynxtron-go/src/app/components/StatusBar/StatusBar.tsx`:

```tsx
import './StatusBar.css';
import type { Tab } from '../../store';

interface StatusBarProps {
  activeTab: Tab | null;
  status: string;
  onSave: () => void;
  canRun?: boolean;
  onRun?: () => void;
}

export function StatusBar({ activeTab, status, onSave, canRun, onRun }: StatusBarProps) {
  return (
    <view className="StatusBar">
      <text className="StatusLang">{activeTab?.language || 'Plain Text'}</text>
      <text className="StatusMsg">{status}</text>
      <view className="StatusRight">
        {canRun && onRun && (
          <view className="StatusRunBtn" bindtap={onRun}>
            <text className="StatusRunBtnText">{'\u25B6 Run'}</text>
          </view>
        )}
        <view className="StatusSaveBtn" bindtap={onSave}>
          <text className="StatusSaveBtnText">
            {activeTab?.isDirty ? '\u25CF Save' : activeTab ? '\u2713 Saved' : ''}
          </text>
        </view>
      </view>
    </view>
  );
}
```

- [x] **Step 2: Add Run button styling**

Append to `lynxtron-go/src/app/components/StatusBar/StatusBar.css`:

```css
.StatusRight {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.StatusRunBtn {
  padding: 2px 8px;
  background-color: #28a745;
  border-radius: 3px;
}

.StatusRunBtnText {
  color: #ffffff;
  font-size: 11px;
}
```

- [x] **Step 3: Build and verify**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go && pnpm run build
```

- [x] **Step 4: Commit**

```bash
git add lynxtron-go/src/app/components/StatusBar/
git commit -m "feat(lynxtron-go): StatusBar Run button for built showcases"
```

---

## Task 5: Wire Everything in App.tsx

Register showcase commands, detect showcase state, connect preload API to UI.

**Files:**
- Create: `lynxtron-go/src/app/commands/showcase-commands.ts`
- Modify: `lynxtron-go/src/app/App.tsx`
- Modify: `lynxtron-go/src/app/store.ts`

- [x] **Step 1: Add showcase helper to store.ts**

Append to `lynxtron-go/src/app/store.ts`:

```typescript
export function showcaseApi() {
  return getExposed()?.showcase;
}
```

- [x] **Step 2: Create showcase commands**

`lynxtron-go/src/app/commands/showcase-commands.ts`:

```typescript
import { registerCommand } from './registry';
import { showcaseApi } from '../store';

export function registerShowcaseCommands(deps: {
  openFolder: (path: string) => void;
  setStatus: (msg: string) => void;
  setPickerOpen: (open: boolean) => void;
  setPickerQuery: (q: string) => void;
  getRootPath: () => string;
  openFolderDialog: () => void;
}) {
  registerCommand({
    id: 'showcase.open',
    label: 'Open Showcase (URL)',
    execute: () => {
      // Close current picker, reopen in URL input mode
      deps.setPickerOpen(false);
      // Use a simple prompt approach: set picker query to a marker
      // and handle it in App.tsx when user submits
      deps.setStatus('Enter showcase URL in the picker (paste URL and press enter)');
      deps.setPickerQuery('');
      deps.setPickerOpen(true);
      // The actual fetch is triggered via a special flow — see App.tsx urlFetchMode
    },
  });

  registerCommand({
    id: 'showcase.run',
    label: 'Run Showcase',
    execute: () => {
      const rootPath = deps.getRootPath();
      if (!rootPath) {
        deps.setStatus('No folder open');
        return;
      }
      const api = showcaseApi();
      if (!api) {
        deps.setStatus('Showcase API not available');
        return;
      }
      if (!api.isBuilt(rootPath)) {
        deps.setStatus('Showcase not built — dist/desktop/main.js not found');
        return;
      }
      try {
        const pid = api.run(rootPath);
        deps.setStatus(`Showcase launched (pid ${pid})`);
      } catch (e: any) {
        deps.setStatus(`Run failed: ${e.message}`);
      }
    },
    when: () => {
      try {
        const api = showcaseApi();
        const rootPath = deps.getRootPath();
        return !!rootPath && !!api?.isShowcase(rootPath);
      } catch { return false; }
    },
  });

  registerCommand({
    id: 'folder.open',
    label: 'Open Folder',
    keybinding: 'Cmd+Shift+O',
    execute: () => deps.openFolderDialog(),
  });
}
```

- [x] **Step 3: Update App.tsx — register commands and wire showcase state**

In `App.tsx`, add imports at the top:

```typescript
import { registerShowcaseCommands } from './commands/showcase-commands';
import { showcaseApi } from './store';
```

Add state for URL fetch mode and showcase detection:

```typescript
const [urlFetchMode, setUrlFetchMode] = useState(false);
const [canRunShowcase, setCanRunShowcase] = useState(false);
```

Add a ref for rootPath (for command closures):

```typescript
const rootPathRef = useRef('');
useEffect(() => { rootPathRef.current = rootPath; }, [rootPath]);
```

Register commands once on mount:

```typescript
useEffect(() => {
  registerShowcaseCommands({
    openFolder,
    setStatus,
    setPickerOpen,
    setPickerQuery: (q: string) => { setPickerQuery(q); setUrlFetchMode(true); },
    getRootPath: () => rootPathRef.current,
    openFolderDialog,
  });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [openFolder, openFolderDialog]);
```

Detect showcase state when rootPath changes:

```typescript
useEffect(() => {
  if (!rootPath) { setCanRunShowcase(false); return; }
  try {
    const api = showcaseApi();
    setCanRunShowcase(!!api?.isShowcase(rootPath) && !!api?.isBuilt(rootPath));
  } catch { setCanRunShowcase(false); }
}, [rootPath]);
```

Add a handler for URL fetch when picker submits in fetch mode:

```typescript
const handlePickerSelect = useCallback((value: string) => {
  if (urlFetchMode) {
    // value is a URL — fetch the showcase
    setPickerOpen(false);
    setUrlFetchMode(false);
    if (!value.startsWith('https://') && !value.startsWith('http://')) {
      setStatus('Invalid URL — must start with https:// or http://');
      return;
    }
    setStatus('Fetching showcase...');
    try {
      const showcasePath = showcaseApi()?.fetch(value);
      if (showcasePath) {
        openFolder(showcasePath);
        setStatus(`Opened showcase: ${showcasePath.split('/').pop()}`);
      }
    } catch (e: any) {
      setStatus(`Fetch failed: ${e.message}`);
    }
    return;
  }
  // Normal file open
  openFile(value);
  setPickerOpen(false);
}, [urlFetchMode, openFile, openFolder]);
```

Add a run handler:

```typescript
const handleRunShowcase = useCallback(() => {
  const api = showcaseApi();
  if (!rootPath || !api) return;
  try {
    const pid = api.run(rootPath);
    setStatus(`Showcase launched (pid ${pid})`);
  } catch (e: any) {
    setStatus(`Run failed: ${e.message}`);
  }
}, [rootPath]);
```

Update the QuickPicker usage in JSX:

```tsx
{pickerOpen && (
  <QuickPicker
    rootPath={rootPath}
    query={pickerQuery}
    filteredFiles={urlFetchMode ? [] : filteredFiles}
    onQueryChange={(q) => {
      setPickerQuery(q);
      // Exit URL fetch mode if user types > or clears
      if (urlFetchMode && (q.startsWith('>') || q === '')) {
        setUrlFetchMode(false);
      }
    }}
    onSelect={handlePickerSelect}
    onClose={() => { setPickerOpen(false); setUrlFetchMode(false); }}
  />
)}
```

Update the StatusBar usage in JSX:

```tsx
<StatusBar
  activeTab={activeTab}
  status={status}
  onSave={saveCurrentFile}
  canRun={canRunShowcase}
  onRun={handleRunShowcase}
/>
```

- [x] **Step 4: Build and verify**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go && pnpm run build
```

- [x] **Step 5: Run tests**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases && pnpm test
```

- [x] **Step 6: Commit**

```bash
git add lynxtron-go/src/app/
git commit -m "feat(lynxtron-go): wire showcase commands, URL fetch, and run button in App.tsx"
```

---

## Task 6: End-to-End Verification

Verify the full integration by launching Lynxtron GO and testing the showcase flow.

- [ ] **Step 1: Build everything**

```bash
cd /Users/bytedance/ws2/lynxtron-show-cases
pnpm build
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 3: Launch Lynxtron GO**

```bash
cd lynxtron-go && npx lynxtron ./dist/desktop
```

Verify:
- IDE window opens
- Press Cmd+P, type `>` — should switch to command palette mode
- See "Open Showcase (URL)", "Run Showcase", "Open Folder" commands
- StatusBar shows Run button when viewing a built showcase directory

- [ ] **Step 4: Test Open Showcase flow (manual)**

In Lynxtron GO:
1. Cmd+P → type `>` → select "Open Showcase (URL)"
2. Paste a showcase URL
3. Verify: showcase is fetched, source code appears in sidebar

Note: This requires the local registry to be running if packages aren't published to npm.

- [ ] **Step 5: Test Run Showcase (manual)**

1. Open the counter showcase directory: `showcases/counter/`
2. StatusBar should show green "Run" button (since it's built)
3. Click Run → independent counter window should open

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: verify showcase integration e2e — fetch, browse, run"
```
