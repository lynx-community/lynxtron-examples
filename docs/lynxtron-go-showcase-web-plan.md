# Lynxtron GO Showcase Web Plan

## Current Definition

当前工作区已经显式进入了“多目标 showcase 的 Web 运行能力”这条线，但当前处于 host-first 重写前的回退收敛阶段。

已确认的事实：

- showcase registry 正在增加 `targets`
- `showcases/cross-platform-notes` 已被标记为 `desktop + web`
- 当前工作区已经完成一次收敛：
  - 先保留 `targets` 与 registry 建模
  - 先撤回未闭环的用户可见入口
  - 再按 host-first 路径补齐 Web 运行链路

当前缺口同样明确：

- `preload.ts` 当前尚未暴露这些 host API：
  - `getTargets`
  - `isWebBuilt`
  - `needsWebSourceRun`
  - `runWeb`
  - `startWeb`
  - `devWeb`
- `showcase-web-server.ts` 也已从当前工作区撤回，等待 host 路径重新定义后再引入
- 因此当前功能还处于“能力建模已保留、运行链路待重写”的状态

## Milestones

### M1. Freeze Web Action Semantics

- 冻结 `Run on Web / Debug on Web` 的产品语义
- 冻结 `targets` 的 registry 契约
- 冻结 built web 与 source web 的切换原则

### M2. Host Bridge Completion

- 在 `preload.ts` 补齐 Web 运行 API
- 打通 built web 的 server / URL 解析路径
- 打通 source web 的命令执行路径

### M3. GO UI Completion

- 让 Gallery、command palette、Run menu、workspace action 统一复用同一条 Web 执行语义
- 让状态栏 / Output 对 Web 运行过程有最低限度可观察性

### M4. Verification And Docs Closeout

- 以 `showcases/cross-platform-notes` 做最小 smoke
- 确认 desktop 路径未被误伤
- 文档收口并记录未覆盖项

## Prioritized Tasks

1. 冻结 `targets` 的来源与默认值
2. 冻结 `Run on Web` 的 built-vs-source 切换规则
3. 补齐 `preload.ts` 的 Web showcase API
4. 决定 built web 的本地 server 与 URL 暴露方式
5. 打通 `Run on Web`
6. 打通 `Debug on Web`
7. 让 `Stop Showcase` 覆盖 GO 启动的 Web 子进程
8. 用 `showcases/cross-platform-notes` 做最小 smoke

## Decisions

- 2026-04-17: 这条能力的目标是“多目标 showcase 的 Web 运行能力”，不是继续扩写 `local runtime` 文档
- 2026-04-17: `targets` 是稳定产品契约，不允许 UI 通过临时脚本探测直接决定是否支持 Web
- 2026-04-17: 第一版只覆盖 showcase，不覆盖 example artifact / folder workspace
- 2026-04-17: 第一版继续使用外部浏览器承载 Web 页面，不把 Web preview 嵌入 GO
- 2026-04-17: `Run on Web` 与 `Debug on Web` 必须和 desktop `Run / Debug` 分开建模，不能借旧的 `Start / Dev` 语义继续堆叠
- 2026-04-17: 旧的 `local-runtime` 草稿不再作为当前 feature 的计划基线；它只描述本地 runtime 联调，不描述 Web target 运行能力
- 2026-04-17: 当前工作区已先撤回未闭环的 Gallery / command / menu Web 入口，后续按 host-first 路径重写

## Risks And Dependencies

- 当前实现的主要风险不是 registry 建模，而是 host 路径尚未定义完成
- built web 与 source web 的切换如果定义不清，容易和 desktop `Run / Debug` 语义混淆
- 如果 `targets` 推断规则过于隐式，会导致 GO UI 和真实能力不一致
- Web 路径需要 browser / local server 级 smoke；仅 build 通过不能证明能力完成

## Current Status

- 状态：in progress, blocked on host bridge completion
- 已完成：
  - `targets` 元数据开始进入 registry 与 store
  - `showcases/cross-platform-notes` 已显式声明 `web` target
  - 未闭环的 Gallery / command / menu Web 入口已从当前工作区撤回
- 未完成：
  - `preload.ts` 的 Web 运行 API
  - built web server 的主路径定义与接线
  - Web 动作的最小 smoke

## Next Step

- 以一张 scoped 实现任务补齐 `preload.ts` 的 Web showcase API 与 built web server 接线
- 在该任务完成前，不将当前工作区里的 `Run on Web / Debug on Web` 视为可验收功能
