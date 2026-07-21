# Workflow

## Operating Model

- 主会话作为 PM，负责需求澄清、产品定义、计划、拆解、验收和状态同步
- 实现任务优先派发给 subagent，PM 不直接承担产品代码实现，除非用户明确改变这一模式
- 重要产品决策、验收结论、计划变化必须记录在 `docs/` 中，而不是只保留在对话里

## Roles And Responsibilities

- PM：维护 `project-goal / product-plan / workflow / status-log`，定义验收标准，决定是否接受或重开任务
- Subagent：按边界实现或验证，返回可审计的结果、验证命令、风险和剩余问题
- User：做产品优先级决策、框架方向决策，以及需要外部环境或版本发布时的介入

## Verification Rules

- Docs-only：不要求 runtime 验证，但必须说明“无 runtime 验证是有意的”
- Product UI / showcase change：至少要求 scoped build + 最小 smoke 验证
- 涉及 Lynx UI 的实现或样式改动时，subagent 必须主动参考 `https://lynxjs.org/llms.txt` 对齐 Lynx 的元素、布局、事件和非浏览器语义，不能按浏览器 CSS/DOM 直觉猜测
- 涉及 `main.ts` / `preload.ts` 的 host 代码时，默认按“标准 Node.js 环境 + Lynxtron bridge 接口”处理；若怀疑运行时能力缺失，必须先用真实 Release binary 验证，再决定是否记录为框架问题或引入应用层 workaround
- Runtime / preview / infra change：要求最小可重复命令证明变更路径已打通
- Dead code cleanup：必须用静态引用证据证明删除项未被 source、tests、build config、package exports/scripts、registry 输入或 documented runtime entrypoints 使用；动态入口不明时默认保留并记录为 follow-up
- OS integration entry（例如 custom scheme、file association、系统级 open-url 钩子）：必须做 packaged-app 级别的最小 smoke；仅有 dev/build 级验证不能视为最终验收
- 如果为 smoke / automation / debug 引入新的入口，必须把入口文档化，至少写清：
  - 入口名称或全局符号
  - 触发方式（例如菜单、命令、Runtime.evaluate）
  - 预期进入的状态
  - 适用范围和非目标
- 如果新增的是对外可调用的 deep link / scheme 入口，还必须额外写清：
  - scheme grammar 与参数约束
  - 支持的平台范围
  - 冷启动与热启动行为
  - 参数非法或目标不存在时的回退方式
- 阶段收口：优先要求实际运行态验证，不以“代码已写完”代替验收
- 被外部问题阻塞时，不得将任务标记为完成态，除非 PM 明确放行并记录原因

## Acceptance Checklist

- 任务范围与派发内容一致
- 结果符合当前计划文档中的目标
- 所需 build / test / smoke 已实际执行
- 证据可回溯，包括命令、关键输出或 MCP 观察结果
- 对 dead code cleanup，删除依据必须可回溯到 import graph、`rg` 引用、package/config entrypoint 或测试/build 结果
- 风险、例外和未完成项被显式记录

## Commit Policy

- 一个 commit 只对应一个可独立理解、审阅、回滚的产品能力、workflow 步骤或 scoped infra 变更
- 共享 infra 改动与产品 UI/showcase 改动尽量拆开提交
- 不提交 `node_modules`、build 产物、vendored 代码或生成物，除非 PM 明确允许
- docs 收口优先单独提交，避免和实现改动混在一起

## Delegation And Handoff Rules

每个 subagent 任务必须包含：

- 目标
- 范围边界
- 拥有的文件或子系统
- 必要验证
- 如果任务涉及 Lynx UI，明确要求参考 `https://lynxjs.org/llms.txt`
- 最终回报格式

每个 subagent 回报至少包含：

- 改动或检查了什么
- 用了哪些命令/验证
- 结果是通过、阻塞还是需要 follow-up
- 仍然存在的风险或未完成项

## Blocker Handling

- 遇到产品目标不清、计划冲突、外部环境阻塞、runtime 问题、发布问题时，立即升级到 PM 记录
- Blocker 必须同时写清：
  - 被什么阻塞
  - 阻塞为什么存在
  - 当前可选方案
  - 下一步建议
- Blocker 没解除前，不得把对应任务记为完成

## Status Reporting Rule

- 每次有计划变动、任务验收、阻塞收敛或下一步调整时，更新 `docs/status-log.md`
- 用户同步保持简洁，但 markdown 记录保持完整
- 当前阶段结束前，至少同步一次：
  - 当前焦点
  - 最近完成项
  - 阻塞项
  - 下一步
