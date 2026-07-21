# Feature: Example Artifact URL Open In Lynxtron GO
- Branch: feat/monorepo-architecture
- Created: 2026-04-02
- Status: implemented and verified

## Goal

让 Lynxtron GO 可以通过扩展命令打开一个符合 example artifact 消费协议的远程 Lynx example，而不要求它先被包装成 Lynxtron showcase。

参考协议文档：

- `/Users/bytedance/ws2/lynx-website/docs/zh/internal/docs-contribution-guide/example-artifact-consumption.md`

## Product Definition

该能力属于 Lynxtron GO 的展示平台增强，不属于 showcase 模型扩展。

最小版本只要求：

- 通过扩展命令输入 example 相对路径 / example id
- example 根地址使用代码内集中配置常量，不向用户暴露完整 URL 输入
- 每次打开都重新拉取 `example-metadata.json` 与关联文件
- 下载内容落到本地临时缓存目录；退出该工程后清理
- 在 IDE 中展示协议里的全部 `files`
- 点击 Run 时弹出 `LynxWindow`，加载 `templateFiles[*].file` 指向的 Lynx bundle

第一版不要求：

- 与现有 showcase fetch/run 语义合并
- Lynxtron desktop host 打包
- Web 运行主链路
- 完整二维码和移动端分发
- 多入口高级交互全部到位
- 长期缓存、版本/hash 复用策略

## Acceptance Target

- 在 Lynxtron GO 中存在清晰入口用于打开 example artifact
- 可以成功请求并解析 `example-metadata.json`
- 文件树与默认文件能显示
- 点击 Run 后能弹出 `LynxWindow` 并加载 Lynx bundle
- 使用真实 example 相对路径完成一次验证

## Steps

### Step 1: Input model and protocol adapter
- [x] 设计 Lynxtron GO 内部的 example artifact 输入模型（相对路径 / example id）
- [x] 增加集中配置常量，定义 example base URL
- [x] 明确 `example-metadata.json` 的拼接与下载逻辑
- [x] 与现有 showcase URL 模型隔离，避免语义混淆
- **Verification:** 文档/代码审查可说明 input 到 metadata/file/template 的映射关系

### Step 2: Fetch and metadata parsing
- [x] 在 GO 中增加 example artifact 拉取流程
- [x] 将下载结果落到临时缓存目录
- [x] 支持读取并解析 `example-metadata.json`
- [x] 错误态明确反馈：metadata 缺失、字段非法、bundle 不存在
- **Verification:** 使用真实相对路径成功获取 metadata，并在 UI 或日志中看到解析结果

### Step 3: File tree and code view
- [x] 根据 `files` 渲染文件树
- [x] 支持默认文件打开
- [x] 文本文件与资源文件按协议分别处理
- **Verification:** 真实 example 的完整文件树可见，默认文件可打开

### Step 4: Lynx bundle preview
- [x] 根据 `templateFiles[*].file` 选择当前 Lynx 入口 bundle
- [x] 点击 Run 时弹出 `LynxWindow`
- [x] 将该 bundle 接入 GO 的运行链路
- [x] 如存在 `webFile`，只展示后续可支持状态，不进入第一版主链路
- **Verification:** 真实 example 的 Lynx bundle 能被 `LynxWindow` 加载

### Step 5: End-to-end verification and docs
- [x] 使用真实 example 相对路径走通一轮最小端到端流程
- [x] 更新 product-plan / status-log / 必要 README
- [x] 按合理粒度提交
- **Verification:** PM 验收通过，文档状态同步完成

## Verification Rules

- 产品 UI 变更至少要求 scoped build + focused smoke
- 任何 Lynx UI / 样式实现都必须主动参考 `https://lynxjs.org/llms.txt`，避免按浏览器布局或 DOM 语义误写
- 协议适配变更必须给出真实 example 相对路径验证证据
- 如果被外部 example 发布端阻塞，必须记录 blocker，不得伪装成完成

## History

- 2026-04-02: Workflow created from PM requirement insertion
- 2026-04-02: Step 1 + Step 2 completed and committed as `685e219`
- 2026-04-02: Step 3 completed and committed as `42e8285`
- 2026-04-02: Step 4 completed and committed in follow-up implementation
- 2026-04-02: Public example source switched to `https://lynxjs.org/next/lynx-examples`
- 2026-04-02: Added local deterministic smoke environment as `b015f4b`
- 2026-04-02: Verified real example path `view` opens a temporary workspace in Lynxtron GO; remaining issue narrowed to loading feedback
- 2026-04-03: Shared `LoadingOverlay` completed and accepted via Lynx DevTool inspection plus user manual UI verification

## Notes

- 真实运行验证表明：功能链路已通，但从命令提交到 workspace 打开之间存在可感知延迟。
- 该延迟当前属于 UX / status feedback 问题，不再作为 Example Artifact 功能阻塞。
- UX follow-up 不再接受“只改状态栏/Output 文案”的实现。
- UX follow-up 的正确方向调整为：实现一个 **共享 loading overlay 组件**，由 Example Artifact 作为第一个接入场景。
- 该 overlay 应覆盖主窗口工作区区域，使用简单的居中 loading 动效；不接受复杂卡片式视觉。
- 这类 UI 调整必须把 Lynx 官方 `llms.txt` 作为直接参考输入，而不是按浏览器 CSS 直觉实现。
- 首版目标：
  - 覆盖主内容区域
  - 居中 spinner
  - busy cursor
  - 文案最小化或可选
- 不要求首版就接入所有场景，但组件设计必须能复用到其他长操作流程。
- 这轮 UX 验收要求新增一条：必须通过真实 Lynx DevTool 观察 loading overlay，确认其覆盖范围、层级、持续时间和消失时机都合理。
- 上述 UX 验收现已完成：共享 overlay 方案通过，Example Artifact 的 UX 阻塞解除。
