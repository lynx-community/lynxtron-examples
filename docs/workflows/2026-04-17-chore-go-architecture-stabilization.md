# Chore: Lynxtron GO Architecture Stabilization
- Branch: current workspace
- Created: 2026-04-17
- Status: planned

## Goal

在不改变仓库顶层架构的前提下，对 `lynxtron-go` 做一轮受控的定向架构整治，降低后续继续推进 scheme、example artifact、workspace source mode 和 IDE 能力时的修改成本与验收复杂度。

本轮目标不是“重写 Lynxtron GO”，而是把已经暴露出来的单点复杂度拆开，并把导航语义、workspace 语义和运行语义收敛到稳定边界内。

## Product Definition

当前冻结的产品决策：

- 不做 monorepo 级大重构
- 不调整 `packages/cli` thin launcher 方向
- 不改变 showcase 作为完整 Lynxtron app 的模型
- 不暂停现有 GO 能力演进去做一次性重写

本轮只做 `lynxtron-go` 内部架构整理，范围集中在：

- app shell / navigation / workspace model
- host/app 的 deep-link 与 run 语义边界
- preload service 模块化

本轮必须保证：

- gallery、workspace、showcase run、example artifact run 的现有产品语义不回退
- 已有 workflow 中定义的 route foundation / deep-link / example artifact 能力不被绕开
- 整治后的边界可继续承接后续能力，而不是产生另一层临时包装

本轮不做：

- 改写 showcase / CLI 的产品模型
- 引入新的 router 框架或状态管理框架作为目标本身
- 顺手扩 scope 到新的 gallery 功能或 IDE 功能
- 以“大文件拆小文件”替代领域模型收敛

## Acceptance Target

- `lynxtron-go` 的主视图、workspace source mode、run target 有统一且可解释的领域模型
- `App.tsx` 不再继续同时承载主视图导航、workspace orchestration、editor/runtime integration 三类职责
- `preload.ts` 的 bridge/service 职责拆成可独立验证的模块
- host -> app 的 deep-link / pending intent / run 相关语义通过稳定边界接入，不依赖多份平行状态猜测
- 每一步都能以 scoped build/test/smoke 独立验收，而不是等“整轮重构做完”再看

## Steps

### Step 1: Workspace session and route model convergence
- [x] 收敛 `route`、`ideMode`、`rootPath`、`lastWorkspacePath` 等并行状态，形成统一的 workspace session 模型
- [x] 明确 `home` / `workspace`、workspace source、active file、run target 之间的拥有关系
- [x] 让 route 保持主视图职责，同时不再让运行语义分散在多个互相推断的状态里
- [x] 补 focused test，覆盖 showcase / folder / example-artifact 三类 workspace session 映射
- **Verification:** `pnpm --dir lynxtron-go exec vitest run` 跑本次新增的 model / mapper tests；必要时补一个不依赖键盘注入的 debug entry 或现有测试入口回归

### Step 2: App shell and workspace orchestration split
- [ ] 将 `App.tsx` 至少拆成 app-shell/navigation、workspace orchestration、editor/runtime integration 三层边界
- [ ] 保持 Home 与 IDE 的组件边界清晰，避免回到“首页只是 IDE 的一个布尔分支”
- [ ] 复用现有 commands / showcase open / example open 主链路，不复制业务逻辑
- [ ] 对受影响链路做 scoped build 与最小 smoke，至少回归：
  - gallery -> showcase workspace
  - open folder -> workspace
  - example artifact -> workspace
- **Verification:** `pnpm --dir lynxtron-go build`；再做至少一轮真实运行态 focused smoke，证明 workspace 打开链路未回退

### Step 3: Preload service modularization
- [x] 将 `preload.ts` 拆成明确 service 模块，至少区分：
  - config/fs bridge
  - language service / diagnostics bridge
  - terminal / process management
  - showcase / example runtime service
- [x] 保持 expose 出去的 bridge contract 稳定，避免 UI 同步跟着大面积改接口
- [x] 对拆分后的模块补最小单测或 focused verification，证明 `extHost`、PTY、run 链路仍然可用
- **Verification:** 相关 focused tests；若无现成测试，则至少执行最小可重复命令证明 diagnostics / terminal / run 中至少两条关键链路仍通

### Step 4: Deep-link and run-semantics boundary cleanup
- [ ] 在新的 workspace/session 模型上重新收敛 deep-link、pending intent、run target 的接线点
- [ ] 确保 `route` 不直接决定 run，run 继续由显式 workspace mode / run target 决定
- [ ] 回归当前 `lynxtron://` 相关本地 smoke，避免架构整理再次打断 scheme 主线
- **Verification:** focused test + scoped build；如本地 runtime 入口可用，至少回归一轮 `showcase.open` 和一轮 deep-link workspace 打开

### Step 5: Docs closeout
- [ ] 更新 `docs/product-plan.md`、`docs/status-log.md` 与相关 feature workflow 状态
- [ ] 记录本轮留下的 follow-up，而不是把“结构更清晰”直接记成终态完成
- [ ] 按步骤粒度提交，不把整轮整治压成单一大 commit
- **Verification:** PM review 通过，文档与实现状态一致

## Verification Rules

- 本轮属于架构整理，不接受“只有文件移动、没有行为保护”的伪重构
- 每一步至少要满足“模型可解释 + scoped verification 已执行 + 风险已记录”
- UI / state 改动：要求 focused test 或最小 smoke，加 `pnpm --dir lynxtron-go build`
- preload / host 改动：要求 focused verification 证明 bridge/service 没断
- 若改动影响 deep-link、example artifact、showcase run，必须至少回归其中一条真实链路
- 被现有 runtime / packaging 问题阻塞时，状态只能记为 `follow-up needed` 或 `blocked`，不能记为完成

## Delegation Notes

后续 subagent 派发必须遵守以下边界：

- 一个子任务只拥有一个清晰切片，不同时处理 app model、preload service 和 packaged deep-link 收口
- 必须列出拥有的文件集合，避免多个实现同时编辑同一核心文件
- 回报中必须明确：
  - 改了什么模型或边界
  - 改了哪些文件
  - 跑了哪些验证
  - 哪些 follow-up 被刻意留到下一步

## Notes

- 当前已知热点：
  - `lynxtron-go/src/app/App.tsx`
  - `lynxtron-go/src/main/desktop/preload.ts`
  - `lynxtron-go/src/main/desktop/main.ts`
- 本 workflow 是为了给后续 feature 让路，不是替代 feature roadmap
- scheme handler 的 packaged smoke 仍然是独立验收项；本轮不能用“架构整理中”替代它

## History

- 2026-04-17: PM 基于现有代码与文档复核，确认仓库级架构方向仍成立，但 `lynxtron-go` 已出现需要独立收口的局部架构债
- 2026-04-17: Workflow created to split GO 架构整治 into 5 individually dispatchable and reviewable steps, avoiding a one-shot "big refactor"
- 2026-04-17: Step 1 accepted after converging app-side workspace state on `WorkspaceSession`, adding explicit session -> route / run-target helpers, and closing the active-file ownership gap
- 2026-04-27: Step 3 accepted after modularizing `preload.ts` into focused services and independently re-verifying build plus example-artifact focused tests
