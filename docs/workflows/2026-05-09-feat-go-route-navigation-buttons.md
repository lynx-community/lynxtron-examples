# Feature: Lynxtron GO Route Navigation Buttons
- Branch: current workspace
- Created: 2026-05-09
- Status: implemented; preview manual validation pending

## Goal

给 Lynxtron GO 的 IDE workspace 增加主视图路由 Back / Forward 按钮，让用户在 IDE 模式中可以返回 gallery home，并在需要时前进回到刚才的 workspace。

## Artifact / Distribution / Runtime

- Artifact type: Lynxtron GO showcase app
- Distribution type: source workspace change, later included in normal GO build / preview artifact
- Runtime path: Lynxtron GO desktop window, Lynx UI app shell route state

## Product Definition

该能力建立在现有 route foundation 和 `WorkspaceSession` 模型上。它只管理 `home` 和 `workspace` 之间的主视图导航，不管理 editor 内部历史。

最小行为：

- IDE workspace 中显示 Back / Forward 路由按钮
- Back 在 workspace 中可用，点击后进入 gallery home
- Back 进入 home 时清空 active `workspaceSession` / ref，避免首页状态下 Run / Debug 仍作用于隐藏 workspace
- Forward 在 Back 之后可用，点击后恢复刚才的 `WorkspaceSession` 并回到 workspace
- Forward 恢复后，原有 tabs、active file、目录树和 workspace source 尽量保持不变
- 打开新的 folder / showcase / example workspace 视为新的导航分支，清空旧 forward 目标
- 按钮有 disabled 状态，不可用时不触发导航

非目标：

- 不做文件导航历史、tab 历史、cursor 历史
- 不引入第三方 router 或浏览器式 URL history
- 不改变 Run / Debug 的 ownership；Run 仍由 explicit workspace session / run target 决定
- 不把操作按钮加入 StatusBar

## Acceptance Target

- 从任意 folder / showcase / example workspace 点击 Back 后，主视图切到 `home`
- Back 后 `workspaceSession` 为空，Run / Debug 不会误作用于隐藏 workspace
- Back 后点击 Forward 能回到刚才 workspace，并保留 workspace source 和 active file
- 打开新 workspace 后，旧 forward 目标失效
- UI 使用 Lynx 语义：`view` / `text` / `bindtap`，不使用 DOM/BOM 或 HTML 元素
- 现有 gallery、open folder、open showcase、open example、deep link home 行为不回退

## Implementation Scope

Worker owns these areas:

- `lynxtron-go/src/app/shared/navigation.ts` or a focused sibling helper for top-level route history
- `lynxtron-go/src/app/shared/*.test.ts` focused tests for route history behavior
- `lynxtron-go/src/app/App.tsx` route/session wiring only where needed
- `lynxtron-go/src/app/components/IDE/IDE.tsx` and adjacent CSS / component files for visible buttons
- Any new small component under `lynxtron-go/src/app/components/IDE/` or `components/Layout/` if that keeps the chrome clean

Worker must not change:

- `packages/cli`
- showcase packages
- host / preload run semantics unless a real compile error requires a minimal type-only adjustment
- StatusBar action model

## Required Verification

- `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts` plus any new focused navigation test
- `pnpm --dir lynxtron-go build`
- At least one runtime smoke if environment permits:
  - open GO
  - enter a workspace
  - click Back to home
  - click Forward to restore workspace
  - confirm Run is not available while on home after Back

If runtime smoke is blocked by local environment, record the blocker and do not mark runtime acceptance complete.

## Handoff Requirements

Worker final note must include:

- Files changed
- Navigation model chosen
- Verification commands and results
- Whether runtime smoke was completed or blocked
- Any remaining risk

## History

- 2026-05-09: PM created workflow and accepted the requirement scope as a route foundation increment.
- 2026-05-09: Worker implemented one-slot route navigation state, IDE route controls, and focused helper tests.
- 2026-05-09: PM accepted build/test verification and partial runtime DOM smoke. Manual Back / Forward click smoke remains pending because DevTool input injection did not trigger `bindtap` in the runtime session.
- 2026-05-09: Preview validation found native Scintilla editor view remained over Gallery after Back. PM patched Scintilla native view detach lifecycle plus route-home cleanup; focused tests and GO build passed.
- 2026-05-09: Preview validation then found a crash when navigating back from a second editor to the first. PM patched Scintilla registry unregister semantics so an old native view cannot remove a newer `main-editor` mapping; focused tests and GO build passed.
