# Feature: Lynxtron GO URL Scheme Handler
- Branch: feat/monorepo-architecture
- Created: 2026-04-10
- Status: follow-up needed

## Goal

让 Lynxtron GO 可以被 `lynxtron://` deep link 唤起，并把外部 URL 稳定映射为 GO 内部的 `home / showcase / example` 打开动作。

## Product Definition

该能力属于 Lynxtron GO 的外部入口扩展，不是新的 showcase 模型，也不是 debug-only 的临时命令。

第一版范围：

- scheme 名称：`lynxtron://`
- 支持：
  - `lynxtron://home`
  - `lynxtron://showcase/open?id=<showcase-id>`
  - `lynxtron://example/open?path=<example-relative-path>`
- `showcase-id` 只允许映射到 baked-in registry 中的稳定项
- `example path` 复用现有 Example Artifact 相对路径输入模型
- 已运行时复用当前主窗口
- 未运行时支持冷启动接管 URL
- 只打开目标状态，不自动 Run

第一版不做：

- `folder/open`
- `bundle.runUrl`
- `bundle.runFile`
- 自动运行参数
- 任意远程 URL 透传
- 多平台一次性全覆盖承诺

## Acceptance Target

- Lynxtron GO 在主进程早期注册并监听 custom scheme
- 冷启动可以从 scheme 进入目标 home / workspace
- 热启动第二次触发 scheme 时，复用现有主窗口并切换到目标 home / workspace
- showcase deep link 可以稳定打开 registry 对应项目
- example deep link 可以稳定进入 Example Artifact workspace
- 非法参数、未知 showcase、错误 example path 有可理解反馈
- 现有 gallery、command、Run 语义不被破坏

## Steps

### Step 1: URI grammar and deep-link model
- [x] 冻结 scheme grammar、参数模型和非目标
- [x] 设计统一的 deep-link parse 结果对象，避免 UI 直接依赖原始 URL 字符串
- [x] 明确 showcase id 与 registry 的映射规则
- [x] 明确 example path 与现有 Example Artifact 打开链路的接点
- **Verification:** 代码/文档审查可说明 URL 到目标动作的映射关系；补 focused parser test

### Step 2: Host registration and single-instance routing
- [x] 在 host 启动早期注册 `open-url` 监听
- [x] 接入 `requestSingleInstanceLock()` 与 `second-instance`，收敛热启动行为
- [x] 对冷启动 URL 做 pending intent 缓存，等待主窗口与 UI 就绪后再分发
- [x] 对无效 URL 做最小错误处理和日志
- **Verification:** scoped build；host 级 focused test 或最小日志型验证证明冷/热启动两条链路被接入

### Step 3: UI bridge and route integration
- [x] 增加 host -> UI 的 deep-link dispatch 边界
- [x] 复用现有 `showcase.open` / `example.open` 主链路，而不是复制新逻辑
- [x] 确保 route 只管主视图，Run 仍由显式 `ideMode` 决定
- [x] 为错误态提供状态栏 / output 的最小反馈
- **Verification:** focused test；必要时增加 debug hook 或 bridge-level injection，证明 URL 能落到正确 workspace

### Step 4: Packaged-app protocol registration and smoke
- [x] 在打包配置中把正式 scheme 名称与产品命名统一
- [ ] 验证 macOS packaged app 的 protocol registration 生效
- [ ] 用真实 deep link 做至少一轮冷启动 smoke
- [ ] 用真实 deep link 做至少一轮热启动 smoke
- **Verification:** packaged app smoke 为必选；至少记录命令、URL、结果窗口状态和关键日志

### Step 5: Docs closeout
- [ ] 更新 product-plan / status-log / 必要 README
- [ ] 记录支持的 URI grammar、平台范围和非目标
- [ ] 按合理粒度提交
- **Verification:** PM 验收通过，文档状态同步完成

## Verification Rules

- 属于 host + Product UI + OS integration 联动变更，至少要求：
  - focused test
  - scoped build
  - packaged-app deep link smoke
- 只做 dev server / build 通过，不能作为最终验收
- 如果为 scheme 引入新的 bridge/debug 注入入口，必须同步记录入口名称、触发方式和适用范围
- 若被打包环境或系统注册问题阻塞，必须记录 blocker，不得伪装为功能完成

## Notes

- 当前 route foundation 已具备进入 workspace 的基础边界，scheme 不应绕过这层直接拼 UI 状态
- 当前打包配置里已有 `LynxtronIDEMVP` 占位 scheme；实现时需要统一正式命名并明确是否保留兼容别名
- 第一版优先做“稳定打开”，不把 `Run` 自动化混进来，避免把 scheme 变成第二套命令协议

## History

- 2026-04-10: Workflow created from PM requirement clarification for `lynxtron://` deep link support
- 2026-04-10: User confirmed the MVP defaults: reuse the current main window, open without auto-run, and standardize the public scheme name as `lynxtron://`
- 2026-04-10: Implementation returned with parser + host + UI wiring complete; focused tests and scoped build passed
- 2026-04-10: PM review result is follow-up-needed rather than fully accepted because `pnpm --dir lynxtron-go run pack` fails before packaged protocol smoke, blocking Step 4 validation
- 2026-04-10: User temporarily deprioritized packaged validation and asked to inspect un-packaged local runtime behavior first
- 2026-04-10: PM verified that local cold-start argv routing and real scheme invocation both reach host-side deep-link queueing, but the UI still remains on Gallery Home instead of entering the target workspace
- 2026-04-10: Current follow-up scope is narrowed to the UI startup consume handshake and hot-notify reliability before returning to packaged-app validation
- 2026-04-10: Local runtime issue was narrowed from bridge ingress to baked registry URLs; deep-link dispatch was healthy, but showcase entries with empty `url` values caused `openShowcaseEntry()` to return early
- 2026-04-10: The feature now has an explicit showcase source mode split: default `remote` build bakes GitHub URLs for release, while `local-registry` builds bake `file://` tarballs for pre-publication testing
- 2026-04-10: PM re-verified the un-packaged local smoke through the dedicated local-registry path: `lynxtron://showcase/open?id=benchmark` now resolves to `file://...benchmark-0.0.1.tgz`, fetches into `~/.lynxtron-go/showcases/benchmark`, and opens the workspace successfully
