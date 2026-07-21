# Feature: Lynxtron GO Debug Bundle File Runner
- Branch: feat/monorepo-architecture
- Created: 2026-04-09
- Status: in progress

## Goal

为 Lynxtron GO 增加一个 **debug-only** 的本地 Lynx bundle 直开链路，用于直接运行本机 `*.lynx.bundle` 文件，而不要求它先被包装成 showcase 或 example artifact。

## Product Definition

该能力不是 showcase，也不是 example artifact。

它只解决一个窄问题：

- 用户有一个本地 `*.lynx.bundle` 文件
- 在 Lynxtron GO 中通过命令入口触发运行
- 宿主侧起一个独立 `LynxWindow`
- 对本地 bundle 执行 `loadFile(...)`

第一版范围：

- 命令入口：`Run Bundle File`
- 输入：选择一个本地 `*.lynx.bundle` 文件
- 行为：启动独立预览窗口并加载该 bundle
- debug-only，可接受较轻的 UX

第一版不做：

- 历史记录
- route / scheme 深链
- gallery 卡片化
- 与 showcase / example artifact 语义合并
- 用 `file://` 字符串去复用远程 URL runner

## Acceptance Target

- 可以在 Lynxtron GO 中通过命令入口触发本地 bundle 文件选择
- 宿主侧能起独立 `LynxWindow`
- 该窗口对本地 bundle 执行 `loadFile(...)`
- 对取消选择、缺失文件、非法路径有最小可理解反馈
- 不破坏现有 showcase / example artifact / bundle URL 链路

## Steps

### Step 1: Host file-run API
- [x] 在 host / preload 层增加一个最小本地 bundle run API
- [x] API 支持选择或接收本地 bundle 路径，并启动独立预览窗口
- [x] 运行路径使用 `LynxWindow.loadFile(...)`
- **Verification:** scoped build；最小测试覆盖路径校验或参数分支；错误输入不会崩

### Step 2: Command entry
- [x] 增加 `Run Bundle File` 命令
- [x] 从命令入口触发本地 bundle 选择并调用 host run API
- [x] 提供最小状态反馈，不与 `Run Bundle URL` 混淆
- **Verification:** 可以通过命令链路进入本地 bundle 运行流程

### Step 3: Focused smoke
- [ ] 用一个真实本地 `*.lynx.bundle` 跑通一次
- [ ] 记录最小验证结论
- [ ] 如需要自动化 smoke，可使用 `__ide_debugRunBundleFile(path)` 直接传入本地路径；该 hook 仅用于调试和验证
- **Verification:** 指定本地 bundle 能打开独立窗口并进入 `loadFile(...)` 流程

### Step 4: Docs closeout
- [ ] 更新 status log
- [ ] 明确记录该能力是 debug-only 临时调试入口
- **Verification:** PM 验收通过，文档同步完成

## Verification Rules

- 属于 Product UI / host 联动变更，至少要求 scoped build + focused smoke
- 如果为 smoke / automation 增加新的 debug hook 或 host 参数，必须把入口名称、触发方式、适用范围和非目标记入文档
- debug-only 能力也必须保持 commit 粒度清晰，不得混入 showcase / example artifact 的无关改动

## Notes

- 优先做成最小调试能力，不追求完整产品化
- 本地 bundle 直开与 example artifact `file://` 协议消费是两条不同能力边界，不应混用产品语义
- 该能力的自动化 smoke 允许使用 `__ide_debugRunBundleFile(path)` 这类临时调试 hook，但用户主入口仍然是命令触发 + 本地文件选择

## History

- 2026-04-09: Code path completed with `Run Bundle File` command, host-side `openBundleFile`, and debug hook `__ide_debugRunBundleFile(path)`
- 2026-04-09: Scoped verification passed with `pnpm --dir lynxtron-go test -- src/app/commands/showcase-commands.test.ts` and `pnpm --dir lynxtron-go build`
- 2026-04-09: Real runtime smoke remains blocked by startup failure unrelated to this feature path: `npx lynxtron ./dist/desktop` errors with `Cannot find module '@lynx-js/lynxtron'` from `/private/tmp/lynxtron-shell-repro/desktop/main.js`
