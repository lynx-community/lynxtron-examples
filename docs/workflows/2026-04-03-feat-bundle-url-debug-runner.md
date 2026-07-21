# Feature: Lynxtron GO Debug Bundle URL Runner
- Branch: feat/monorepo-architecture
- Created: 2026-04-03
- Status: completed

## Goal

为 Lynxtron GO 增加一个 **debug-only** 临时调试链路，用于直接运行远程 `*.lynx.bundle` URL，便于快速验证临时发布产物。

## Product Definition

该能力不是 showcase，也不是 example artifact。

它只解决一个窄问题：

- 用户提供一个远程 Lynx bundle URL
- Lynxtron GO 通过命令入口触发
- 由宿主侧起一个独立 `LynxWindow`
- 直接对该 URL 执行 `loadURL(...)`

第一版范围：

- 命令入口：`Run Bundle URL`
- 输入：一个完整远程 bundle URL
- 行为：启动独立预览窗口并加载该 bundle
- debug-only，可接受较轻的 UX

第一版不做：

- 长期保存历史
- route / scheme 深链
- Web bundle 区分
- metadata 协议
- gallery 卡片化

## Acceptance Target

- 可以在 Lynxtron GO 中通过命令入口输入 bundle URL
- 宿主侧能起独立 `LynxWindow`
- 该窗口对远程 URL 执行 `loadURL(...)`
- 对错误输入有最小可理解反馈
- 不破坏现有 showcase / example artifact 链路

## Steps

### Step 1: Host run API
- [x] 在 preload / host 层增加一个最小 debug run API
- [x] API 接收远程 bundle URL，启动独立预览窗口
- [x] 运行路径使用 `LynxWindow.loadURL(...)`
- **Verification:** scoped build；宿主 API 可调用；错误输入不会崩

### Step 2: Command entry
- [x] 增加 `Run Bundle URL` 命令
- [x] 在 Quick Open / command palette 中进入 URL 输入模式
- [x] 提交后调用 host run API
- **Verification:** 可以通过命令链路输入 URL 并触发运行

### Step 3: Real smoke
- [x] 用真实 bundle URL 跑通一次
- [x] 记录最小验证结论
- **Verification:** 指定远程 bundle URL 能打开独立窗口并进入加载流程

### Step 4: Docs closeout
- [x] 更新 status log
- [x] 记录该能力是 debug-only 临时调试入口
- **Verification:** PM 验收通过，文档同步完成

## Verification Rules

- 属于 Product UI / host 联动变更，至少要求 scoped build + focused smoke
- 涉及 Lynx UI / 样式实现时，必须参考 `https://lynxjs.org/llms.txt`
- debug-only 能力也必须保持 commit 粒度清晰，不得混入 route / example artifact 的无关改动

## Notes

- 优先做成最小调试能力，不追求完整产品化
- 后续如有需要，可再收敛进 scheme / route foundation

## History

- 2026-04-03: Code path completed and committed as `943e551`, adding a debug-only `Run Bundle URL` command and bridge-backed `openBundleUrl` flow in Lynxtron GO
- 2026-04-03: Real smoke passed against `http://10.69.205.46:3000/desktop_showcase.lynx.bundle`; runtime logs confirmed `bridge.openBundleUrl`, `LynxWindow` creation, `loadURL(...)` returning `true`, and `ok=true` callback to the app
