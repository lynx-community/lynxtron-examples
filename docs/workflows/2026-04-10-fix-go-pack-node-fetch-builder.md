# Feature: Restore Lynxtron GO Packaged Build After node-fetch Builder Failure
- Branch: feat/monorepo-architecture
- Created: 2026-04-10
- Status: planned

## Goal

恢复 `pnpm --dir lynxtron-go run pack`，解除 Lynxtron GO URL scheme handler 的 packaged-app 验收阻塞。

## Problem Definition

当前 `lynxtron-go` 已完成 `lynxtron://` 的 host/UI 接线，但 packaged 验收仍被打包阶段阻塞：

- `dependency path is undefined packageName=node-fetch`
- `unable to parse 'path' during 'tree.dependencies' reduce`

该错误发生在 `lynxtron-builder` / electron-builder 收集依赖树阶段，导致 `.app` 产物未生成，因此无法继续验证：

- protocol registration 是否进入打包产物
- cold-start deep-link smoke
- warm-start deep-link smoke

## Product Definition

这是一个 **scoped packaging follow-up**，不是新的产品功能。

第一版目标只要求：

- 恢复 `lynxtron-go run pack`
- 不破坏已有 example artifact / showcase / deep-link 行为
- 为 scheme handler 的 packaged smoke 恢复前提

不要求：

- 在这一任务中顺手完成 deep-link smoke
- 顺手做其他打包体积优化
- 重构整个 `dist/desktop/package.json` 生成策略，除非确有必要

## Acceptance Target

- `pnpm --dir lynxtron-go run pack` 通过
- 打包修复范围清晰、聚焦，不引入无关产品行为变化
- 如需要调整 `node-fetch` 使用或 host bundling / packaging 配置，必须有 focused 说明和最小验证
- 修复结果可以作为下一步 packaged deep-link smoke 的可靠基线

## Steps

### Step 1: Root cause isolation
- [ ] 明确错误来自哪一层：
  - `node-fetch` 运行时依赖选择
  - `dist/desktop/package.json` 依赖声明
  - pnpm symlink / electron-builder 依赖树收集
  - host bundling externals / copy 策略
- [ ] 记录最小可解释的根因结论
- **Verification:** 通过代码和命令证据说明失败点，而不是只靠猜测

### Step 2: Scoped fix
- [ ] 选择最小修复路径，优先避免为一个 HTTP 下载能力保留高摩擦的额外 runtime dependency
- [ ] 保持 example artifact 获取链路语义不变
- [ ] 避免把 scheme 或其他 UI 逻辑混入本任务
- **Verification:** focused test 或现有回归测试 + 代码审查能够说明行为保持

### Step 3: Pack verification
- [ ] 运行 `pnpm --dir lynxtron-go build`
- [ ] 运行 `pnpm --dir lynxtron-go run pack`
- [ ] 记录产物生成或最小打包完成证据
- **Verification:** `pack` 通过为必选

### Step 4: Handoff back to scheme feature
- [ ] 记录该修复已解除 scheme handler 的 packaged 验收前置阻塞
- [ ] 把后续 packaged deep-link smoke 作为下一任务返回给 PM
- **Verification:** PM 验收通过，状态同步完成

## Verification Rules

- 这是 infra / packaging 变更，至少要求：
  - root-cause evidence
  - scoped build
  - packaged build pass
- 不接受“代码看起来应该可以”但没有 `pack` 通过证据的交付
- 若修复涉及 host Node runtime 能力判断，必须按仓库规则优先把 `main.ts / preload.ts` 当成标准 Node.js 环境处理，再决定是否去掉额外依赖

## Notes

- 当前已知线索：
  - `lynxtron-go/dist/desktop/package.json` 直接带有 `node-fetch`
  - `lynxtron-go/src/main/desktop/example-artifact.ts` 运行时动态 `import('node-fetch')`
  - `lynxtron-go/node_modules/node-fetch` 是 pnpm symlink
- 新增根因线索：
  - `@lynx-js/lynxtron-builder` 包中存在 `patches/app-builder-lib+26.0.12.patch`
  - patch 内容明确删除 mac Helper rename 逻辑
  - 当前 live `app-builder-lib` 仍是未打补丁版本
  - 该包自带的 `patch.js` 依赖 `patch-package` 去 patch `node_modules/app-builder-lib`
  - 在当前 pnpm 布局下，真实包位于嵌套 `.pnpm/.../node_modules/app-builder-lib`，因此 patch 未命中
- 需要谨慎区分：
  - “修 builder 收集依赖树”
  - “去掉不必要 runtime dependency”
  - “改 dist package manifest 生成策略”
- 以及新增的一条：
  - “修 lynxtron-builder patch 在 pnpm 布局下的实际应用路径”
- 目标是最小修复，不默认做大重构

## History

- 2026-04-10: Workflow created after PM reproduced `lynxtron-go run pack` failure and confirmed it blocks scheme packaged smoke
- 2026-04-10: First implementation removed `node-fetch` packaging blocker, but `pack` then failed on missing Helper rename path
- 2026-04-10: PM confirmed the deeper blocker is likely an unapplied `lynxtron-builder` patch against `app-builder-lib` under pnpm layout
