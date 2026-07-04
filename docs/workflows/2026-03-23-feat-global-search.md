# Feature: Global Search + openFileAt Navigation
- Branch: feat/monorepo-architecture
- Created: 2026-03-23
- Status: completed

## Summary

1. `openFileAt` — universal navigation primitive (open file → scroll to line → select text)
2. Preload search API — recursive file search in current directory
3. Search panel UI — input + results list with file/line/preview
4. Wire Cmd+Shift+F hotkey

## Observability
- **Log command:** `tail -f /tmp/lynxtron_stdout.log`
- **Error capture:** Output panel + `/tmp/lynxtron_debug.log`
- **Observation:** DevTool MCP + visual inspection

## Steps

### Step 0: Observability Ready
- [x] Verified: launch app, logs visible, both extensions registered
- **Status:** completed

### Step 1: `openFileAt` universal navigation primitive
- [x] C++ layer — added `gotoLine`, `setSelection`, `scrollCaret`, `PositionFromLine` to ScintillaView + Registry + NAPI bindings
- [x] Native build — `npx cmake-js compile` passes (43/43), `lynx_scintilla_module.node` 1.3MB
- [x] Extension-builder — migrated to `@lynx-js/extension-builder@0.0.1-alpha.1` with Lynx headers under `include/lynxtron/`
- [x] Extensions as workspace members — `pnpm-workspace.yaml` includes `lynxtron-go/extension` and `lynxtron-go/scintilla-extension`
- [x] JS layer — `openFileAt(path, { line, column, selectLength })` in App.tsx; computes byte offsets, calls gotoLine + setSelection + scrollCaret; exposed as `__ide_openFileAt` global
- [x] Verification — build pass, 78 tests pass, existing file open works (user confirmed no regression)
- [x] Step commit
- **Verification:** `pnpm build` succeeds; open a file via sidebar → works (no regression); `openFileAt(path, { line: 5 })` → editor scrolls to line 5
- **Files:** `lynxtron-go/src/app/App.tsx`, `lynxtron-go/src/app/store.ts`, `lynxtron-go/scintilla-extension/module/*.cc/*.mm/*.h`

### Step 2: Preload search API
- [x] Implementation — `search.findInFiles(rootPath, query)` + `utils.utf8ByteLength` in preload.ts
- [x] Verification — 33 results for "useState", 607ms second search (OS cache)
- [x] Step commit
- **Status:** completed

### Step 3: Search panel UI + shared TreeList component
- [x] Implementation — SearchPanel uses shared TreeList (collapsible groups), async search with "Searching..." state
- [x] Verification — search works, results grouped by file, collapsible, click navigates + selects match
- [x] Step commit
- **Status:** completed
- **Notes:** Fixed TextEncoder not available in Lynx (used preload `Buffer.byteLength`). Extracted `TreeList` shared component. Selection highlight color brightened in Scintilla.

### Step 4: Cmd+Shift+F hotkey
- [x] Implementation — Edit > Find in Files (Cmd+Shift+F) in main.ts; ide:findInFiles global event switches sidebar to search
- [x] Verification — user confirmed Cmd+Shift+F switches to Search panel
- [x] Step commit
- **Status:** completed

### Step 5: E2E verification
- [x] Build + 78 tests pass
- [x] Manual: type query → results with file/line/preview, grouped by file, collapsible
- [x] Manual: click result → opens file, scrolls to line, selects match
- [x] Manual: Cmd+Shift+F opens search
- [x] Step commit
- **Status:** completed

## Documentation Updates
- [ ] AGENTS.md — add Search section + Cmd+Shift+F shortcut
- [ ] README.md — mention search capability

## History
- 2026-03-23: Workflow created
- 2026-03-24: Steps 0-5 completed — openFileAt, search API, TreeList, SearchPanel, Cmd+Shift+F
