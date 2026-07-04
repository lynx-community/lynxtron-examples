# Fix: Example Artifact Run Regression
- Branch: feat/monorepo-architecture
- Created: 2026-04-03
- Status: completed

## Goal

修复 Lynxtron GO 中 example artifact workspace 的 Run 回归。

当前 Run 主链路错误地复用了 showcase 运行语义，导致进入纯 Lynx UI example 后，Run 仍尝试走 showcase / `dist/desktop` 的宿主启动路径。

正确行为应恢复为：

- example artifact workspace 点击 Run 或触发 Run 热键时
- 选择 `templateFiles[*].file` 作为入口 bundle
- 由宿主侧弹出独立 `LynxWindow`
- 直接对本地 bundle 执行 `loadFile(...)`

## Product Definition

该修复只收敛 **Run 语义分流**，不扩展 example artifact 的产品范围。

本次必须保证：

- `showcase` workspace 继续走 `showcase.run(rootPath)`
- `example-artifact` workspace 走专用 example runner
- `bundle.runUrl` 继续只服务 debug-only 的远程 URL 运行
- Run 行为由 **IDE mode** 决定，mode 必须在打开时由命令链路显式设定，而不是运行时再从 route 或 `rootPath` 猜
- `Home` 与 `IDE` 必须是清晰分离的 UI 边界；首页不是 IDE 的一种子状态，而是另一个组件/文件

本次不做：

- 重新设计 Run 菜单结构
- 完整的多入口 template picker
- 将三类运行模式统一成新的复杂抽象

## Acceptance Target

- 在 example artifact workspace 中触发 Run，不再调用 showcase 运行链路
- example artifact 能根据 metadata 选出运行 template，并成功起独立 `LynxWindow`
- 实际运行路径使用本地 bundle `loadFile(...)`
- showcase workspace 的 Run 行为保持不变
- 对缺失 template / bundle 的错误给出最小可理解反馈

## Steps

### Step 1: Route-aware run model
- [x] 梳理当前 Run 入口，确认 menu hotkey / command / workspace open 链路如何设定 IDE mode
- [x] 明确 IDE mode 的最小模型，以及 Home / IDE 的边界
- **Verification:** 代码审查可说明三类运行模式的边界，以及 mode 的写入/消费位置

### Step 2: Host bridge wiring
- [x] 在 preload 暴露 example artifact 专用 run API
- [x] UI Run 逻辑按 IDE mode 选择 showcase 或 example artifact 链路
- [x] 将 Home 与 IDE 拆成独立组件/文件，避免 Run 语义继续耦合在首页容器上
- [x] 复用现有 `runExampleArtifact(...)` / template 选择能力，不重复造另一套 runner
- **Verification:** scoped build；相关类型/桥接调用通过

### Step 3: Focused regression verification
- [x] 增加最小测试或已有测试补强，覆盖 example artifact Run 选择 template 的关键分支
- [x] 进行一次 focused smoke，证明 example artifact Run 不再触发 showcase 运行路径
- [x] 回归 showcase Run 未被破坏
- **Verification:** 至少一条 scoped test/build + 一条 focused smoke 证据

### Step 4: Docs closeout
- [x] 更新 status-log / workflow 状态
- [x] 记录剩余风险或 follow-up
- **Verification:** PM 验收通过，文档同步完成

## Verification Rules

- 属于 Product UI + host bridge 联动回归修复，至少要求 scoped test/build + focused smoke
- 如果改动涉及 Lynx UI 展示或交互，必须参考 `https://lynxjs.org/llms.txt`
- 不接受只在 UI 层屏蔽 Run 按钮而不修正 IDE mode 驱动的运行语义
- 不接受把 example artifact 重新伪装成 showcase 目录来“修通” Run

## Notes

- 当前仓库里 `runExampleArtifact(...)` 与 `pickExampleArtifactRunTemplate(...)` 已存在，但未接入主 Run 链路
- 用户已明确产品决策：Run 不是 route 的属性，而是 IDE mode 的属性；mode 在打开时就应确定
- 用户已明确结构决策：IDE 应拆为独立组件，而不是继续和首页写在同一个文件里
- 本次优先恢复正确语义和边界，不顺手扩 scope 做 template picker 或 scheme 集成
- 本次验收使用的 debug / smoke 入口必须明确记录：
  - `globalThis.__ide_debugOpenExampleArtifactRoute(relativePath = 'view')`
  - `globalThis.__ide_debugRunCurrentWorkspace()`
  - 使用方式：通过 Lynx DevTool `Runtime.evaluate`
  - 目的：不依赖点击或键盘注入，直接进入 example artifact workspace 并触发当前 workspace 的 Run
  - 非目标：不作为最终用户产品入口，只服务调试、验收与自动化 smoke
- 2026-04-03 PM review 结论：
  - 代码已按新方案落地：显式 `ideMode`、`Home` / `IDE` 分组件、example artifact 专用 run API 已接回主链路
  - PM 已复跑 `pnpm --dir lynxtron-go test src/app/example-artifact.test.ts`，14/14 通过
  - PM 已复跑 `pnpm --dir lynxtron-go build`，通过；当前仅保留既有的 `require` 解析 warning
  - PM 随后重试 live smoke 并通过：
    - 使用 Lynx DevTool `Runtime.evaluate` 直接调用 `__ide_debugOpenExampleArtifactRoute("view")`
    - DOM 已切换到 example artifact workspace，状态栏显示 `Example loaded: view`
    - 再调用 `__ide_debugRunCurrentWorkspace()`
    - `/tmp/lynxtron_debug.log` 记录到 `exampleArtifact.run: cachePath=... templateFile=dist/main.lynx.bundle`
    - launcher 日志记录到 `LynxWindow created` 与 `loadFile invoked: .../dist/main.lynx.bundle`
    - 进程层面可见独立 runner 指向 `.lynxtron-launcher/dist/desktop`
