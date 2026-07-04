# 2026-04-10 — Lynxtron GO IDE Support For Showcase Start / Dev

## Goal

让 Lynxtron GO 在 IDE 模式下，对当前打开的 **showcase workspace** 提供两个明确动作：

- `Start Showcase`
- `Dev Showcase`

这不是要求每个 showcase package 自己存在 `start` / `dev` 脚本的文档基线，而是要求 **GO IDE 本身** 能在当前 workspace 上调用这两个本地开发入口。

## Product Definition

### User Story

用户在 Lynxtron GO 中打开一个 showcase 工程后，不应只拥有当前的 `Run Showcase`（直接跑 `dist/desktop`）语义，还应能直接在 GO 中执行：

- `pnpm start`
- `pnpm dev`

以便：

- 用 GO 作为 showcase 的本地开发入口
- 在 GO 内部观察本地启动/开发日志
- 不再要求用户切回外部终端手动执行脚本

### Confirmed Decision

用户已确认第一版 `Dev Showcase` 的语义是：

- GO 只负责在当前 showcase 根目录执行 `pnpm dev`
- showcase **自己负责创建窗口**
- GO 不额外创建第二个 showcase 窗口

因此，第一版不做：

- “GO 帮你再开一个 dev preview 窗口”的额外 orchestration
- 自动探测 dev server ready 后再做二次动作

## Current State

当前 GO 已具备：

- `Run Showcase`
  - 语义：直接运行当前 showcase 的 `dist/desktop`
- `Stop Showcase`

当前 GO **尚未具备**：

- `Start Showcase`
  - 语义：在当前 showcase 根目录执行 `pnpm start`
- `Dev Showcase`
  - 语义：在当前 showcase 根目录执行 `pnpm dev`

相关现状代码：

- `lynxtron-go/src/app/commands/showcase-commands.ts`
- `lynxtron-go/src/app/shared/ide-mode.ts`
- `lynxtron-go/src/main/desktop/preload.ts`

## Scope

第一版只覆盖：

- `ideMode.kind === 'showcase'` 的 workspace
- command / menu / host bridge / process lifecycle
- GO 内部日志展示与 stop 语义

第一版不覆盖：

- folder workspace 的 `start` / `dev`
- example artifact 的 `start` / `dev`
- 自动管理 showcase 自己拉起的窗口
- 多进程复杂编排（例如 dev ready 检测后再次自动打开）

## Acceptance

### Functional

- 在 `showcase` workspace 中可触发：
  - `Start Showcase`
  - `Dev Showcase`
- `Start Showcase` 执行当前 showcase 根目录下的 `pnpm start`
- `Dev Showcase` 执行当前 showcase 根目录下的 `pnpm dev`
- `Stop Showcase` 能停止由 GO 启动的 `start` / `dev` 进程
- 非 showcase workspace 中，这两个动作不可用或明确禁用

### UX

- 命令面板和 Run 菜单中语义清晰区分：
  - `Run Showcase`
  - `Start Showcase`
  - `Dev Showcase`
- 输出面板能看到关键状态：
  - 启动中
  - 已启动 / 进程 pid
  - 退出码
  - 失败信息

### Verification

实现验收至少需要：

- scoped tests（命令注册 / mode gating / host bridge）
- `pnpm --dir lynxtron-go build`
- 一个真实 showcase 的最小 smoke：
  - 在 GO 中打开 showcase workspace
  - 触发 `Start Showcase` 或 `Dev Showcase`
  - 确认子进程实际启动
  - 确认 `Stop Showcase` 可结束该进程

## Suggested Task Split

### Step 1

定义新动作与 mode 约束：

- `Start Showcase`
- `Dev Showcase`

并明确它们只在 `ideMode.kind === 'showcase'` 时可用。

状态：

- Accepted

实现结果：

- 已在命令注册层新增：
  - `showcase.start`
  - `showcase.dev`
- 两个命令当前均为占位动作，不执行 host 进程；这是有意的，因为 Step 1 只负责入口与 mode gating
- 两个命令都已限制为仅在 `ideMode.kind === 'showcase'` 时可用

验证：

- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts`
- 结果：2 / 2 tests passed

### Step 2

扩展 preload host API：

- `showcase.start(rootPath)`
- `showcase.dev(rootPath)`
- 与现有 `showcase.run(rootPath)` 区分

状态：

- Accepted

实现结果：

- 已在 `preload.ts` 的 `showcase` bridge 中新增：
  - `start(showcasePath)`
  - `dev(showcasePath)`
- 当前语义为：
  - `start` 在 showcase 根目录执行 `pnpm start`
  - `dev` 在 showcase 根目录执行 `pnpm dev`
- 两者都已接入现有 `runningShowcases` 进程表，供后续 `Stop Showcase` 生命周期整合使用
- 本步刻意不处理 UI 命令触发、输出面板文案和 stop 路由；这些留到 Step 3

验证：

- `pnpm --dir lynxtron-go build`
- 结果：通过（存在既有 non-blocking warnings，不影响本步验收）

### Step 3

接入 GO UI：

- command palette
- Run menu
- Output 面板日志
- `Stop Showcase` 生命周期收口

状态：

- Blocked

当前 blocker：

- 该步并未被技术问题挡住；host API 已在 Step 2 落地
- 真实阻塞是执行层面：
  - 连续多轮 subagent 派发后，目标文件仍未产生可 review 的有效 diff
  - `showcase-commands.ts` / `App.tsx` / `main.ts` 的最小接线尚未落盘
- 因此当前不能把 Step 3 记为 in-progress with code；应视为执行阻塞

当前结论：

- `Start Showcase` / `Dev Showcase` 仍未从 GO IDE 真正触发到 host API
- `Stop Showcase` 也尚未扩展到这两条新路径
- Step 4 smoke 暂不能开始

### Step 4

做真实 smoke，并记录：

- 至少一个现有 showcase 的 `start`
- 至少一个现有 showcase 的 `dev`

## Status

- In Progress
