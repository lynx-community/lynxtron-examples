# Feature: Current File Search

- Created: 2026-05-08
- Status: ready for implementation
- PM owner: main conversation

## Product Scope

Add a current-file search workflow to Lynxtron GO.

This is distinct from the existing workspace-level Search panel:

- `Cmd+Shift+F` remains `Find in Files` and opens the sidebar Search panel.
- `Cmd+F` / `Ctrl+F` opens an inline find bar scoped only to the active editor file.

## MVP Requirements

- Open find bar from app menu shortcut `CmdOrCtrl+F`.
- Find bar is visible in the IDE/editor workspace, not on the gallery home screen.
- Query is scoped to the active tab text only.
- Empty query shows no matches and does not mutate editor selection.
- Matching is plain substring search. No regex, no replace, no whole-word option in this slice.
- Matching should be case-insensitive by default for the MVP.
- Enter moves to the next match.
- Shift+Enter moves to the previous match.
- Buttons/icons in the find bar support previous, next, and close.
- UI shows match position as `current / total`, and a clear no-result state.
- The current match is highlighted by editor selection or equivalent existing editor navigation behavior, and the editor scrolls it into view.
- Switching tabs recalculates matches for the active tab and current query.
- Closing the find bar clears only find UI state; it must not alter file contents or dirty state.
- Find bar UI and interaction state should be implemented in the Lynx frontend. Host/native work should be limited to shortcut event wiring and existing editor selection/navigation calls.

## Out Of Scope

- Replace.
- Regex search.
- Case-sensitive toggle.
- Whole-word toggle.
- Persisted find history.
- Multi-file search changes.
- Native Scintilla extension changes unless existing JS/native APIs cannot satisfy the MVP.
- Native UI. The search surface must be an app-side Lynx UI component.

## Implementation Handoff

### Owned Area

The implementation worker owns:

- `lynxtron-go/src/main/desktop/main.ts` for the menu shortcut/event.
- `lynxtron-go/src/app/App.tsx` for current-file search state and event handling.
- New or existing `lynxtron-go/src/app/components/**` files needed for a small find bar UI.
- Focused tests under `lynxtron-go/src/app/**` if a pure helper is extracted.

The worker must avoid changing:

- Existing workspace Search panel behavior.
- Showcase run/fetch/install behavior.
- Deep link behavior.
- Example artifact behavior.

### Suggested Design

- Add an Edit menu item `Find` with accelerator `CmdOrCtrl+F`, emitting a new event such as `ide:findInFile`.
- Keep `Find in Files` on `CmdOrCtrl+Shift+F`.
- Implement the visible find bar as a Lynx frontend component or app-side view. Do not use native UI for the find surface.
- Model search state in App or a small app-side helper:
  - `visible`
  - `query`
  - `matches`
  - `activeMatchIndex`
- Use current tab `currentText` when available, otherwise the saved content snapshot.
- Convert match character offsets to byte offsets before calling the editor selection API, following the existing `openFileAt` byte-offset pattern.
- Reuse existing Scintilla APIs where possible:
  - `setSelection`
  - `scrollCaret`
  - existing tab text snapshot/update helpers
- Do not add new Scintilla native extension APIs unless the worker can demonstrate that the existing exposed editor APIs cannot satisfy the MVP.
- Keep the find bar compact and editor-local. It should not be a page-level landing surface or a sidebar replacement.

## Verification Required

Minimum required verification before PM review:

- `pnpm --dir lynxtron-go build`
- Focused tests if helper extraction is added, for example:
  - match calculation
  - wrap-around next/previous navigation
  - case-insensitive matching
- Manual smoke or DevTool-assisted smoke:
  - Open a workspace file.
  - Trigger `Cmd+F` or the menu event.
  - Search a term with multiple matches.
  - Enter moves next; Shift+Enter or previous button moves previous.
  - Close hides the find bar.
  - `Cmd+Shift+F` still opens Search panel.

If runtime smoke is blocked, record the blocker and return the build/test evidence plus exact unverified behavior.

## Acceptance Checklist

- Current-file search does not change workspace-level search.
- Find UI is implemented in the Lynx frontend, with native/host limited to shortcut dispatch and existing editor navigation.
- The shortcut split is clear: `Cmd+F` current file, `Cmd+Shift+F` files.
- Search navigation uses active tab text and stays in sync after tab switches.
- No file content or dirty state mutation occurs from search operations.
- Verification evidence is complete and reproducible.

## Status Log

- 2026-05-08: Scope confirmed by user. MVP excludes replace and advanced matching options.
- 2026-05-08: User clarified UI should be implemented in the frontend as much as possible; handoff updated to require frontend-first find UI.
