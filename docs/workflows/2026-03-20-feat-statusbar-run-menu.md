# Feature: StatusBar Reposition + Run Menu/Hotkeys
- Branch: feat/monorepo-architecture
- Created: 2026-03-20
- Status: completed

## Summary

1. Move StatusBar to window bottom (full width, outside MainArea)
2. Make StatusBar extensible (item registry, left/right sections)
3. Remove Run button from StatusBar
4. Add Run/Stop to app menu with hotkeys (Cmd+R / Cmd+Shift+R)
5. StatusBar shows run status text only

## Observability
- **Log command:** `tail -f /tmp/lynxtron_stdout.log` (launch with `npx lynxtron ./dist/desktop > /tmp/lynxtron_stdout.log 2>&1`)
- **Error capture:** Output panel in Lynxtron GO + `/tmp/lynxtron_debug.log`
- **Observation:** DevTool MCP (`Device_listClients` → `Runtime_listConsole`) + visual inspection

## Steps

### Step 0: Observability Ready
- [x] Verified: launch app, confirm logs visible in stdout, MCP devtool connected
- **Verification:** `grep "[IDE]" /tmp/lynxtron_stdout.log | head -3` shows IDE init logs
- **Status:** completed

### Step 1: Move StatusBar to window bottom
- [x] Implementation — moved StatusBar outside MainArea; added IDEBody wrapper (flex-row) inside IDE (flex-column)
- [x] Verification — DOM box model: StatusBar at y=746→768 (bottom), width=1200 (full); IDEBody 0→746
- [x] Step commit
- **Status:** completed

### Step 2: StatusBar item registry
- [x] Implementation — StatusBarItem interface + registry with left/right alignment + priority; StatusBar polls registry
- [x] Verification — user confirmed: language (left), status (center), save (right) all visible
- [x] Step commit
- **Status:** completed

### Step 3: Remove Run button, add run status + stop handler
- [x] Implementation — Run button removed (Step 2); added runningPid state, handleStopShowcase, run-status StatusBar item
- [x] Verification — build succeeds
- [x] Step commit
- **Status:** completed

### Step 4: Add Run menu + hotkeys
- [x] Implementation — Run menu with Cmd+R / Cmd+Shift+R; global event listeners for runShowcase/stopShowcase
- [x] Verification — user confirmed: Run menu visible, Cmd+R launches showcase, Cmd+Shift+R stops it
- [x] Step commit
- **Status:** completed

### Step 5: End-to-end verification
- [x] Build + 78 tests pass
- [x] Manual: StatusBar at full window bottom (DOM verified: y=746→768, width=1200)
- [x] Manual: Cmd+R runs showcase
- [x] Manual: Cmd+Shift+R stops showcase
- [x] Manual: StatusBar shows language (left), status (center), save (right), run pid (left when running)
- [x] Step commit
- **Status:** completed

## Documentation Updates
- [x] AGENTS.md — updated: StatusBar item registry, Run hotkeys, keyboard shortcuts table, self-hosting
- [x] docs/workflows update with completion status

## History
- 2026-03-20: Workflow created
- 2026-03-23: Steps 0-5 completed — StatusBar repositioned, item registry, Run menu + hotkeys
- 2026-03-23: Documentation updates completed
