# Fix: Example Artifact External-Bundle Default Entry
- Branch: current workspace
- Created: 2026-04-08
- Status: completed

## Goal

修复 Lynxtron GO 打开 `external-bundle` 这类多入口 example artifact 时的默认 Run 入口选择。

当前实现会优先选择名字为 `index` 的 template。对 `external-bundle` 来说，这会把 Run 强制落到一个依赖额外 lazy bundle 解析的入口，并在当前 Lynxtron runtime 上触发致命崩溃。

这次修复把默认入口选择收敛回协议约定：

- 如果协议没有显式 default entry 字段
- 默认入口应退回 `templateFiles[0]`
- 不再对 `"index"` 做额外特判

## Product Definition

本次只修复 **example artifact 多入口默认模板选择**，不扩展产品能力。

必须保证：

- `view` 这类单入口 example 的行为保持不变
- 多入口 example 的默认 Run 入口与协议文档一致
- `external-bundle` 不再默认选择 `index`
- 改动集中在 example artifact shared model / tests，不扩 scope 到新的 template picker UI

本次不做：

- 新增多入口切换 UI
- 重写 launcher 机制
- 修改 showcase Run 语义

## Acceptance Target

- `pickExampleArtifactRunTemplate(...)` 默认返回 `templateFiles[0]`
- `buildExampleArtifactRunContext(...)` 跟随新默认入口
- 增加覆盖多入口 metadata 的测试，证明 `index` 不再被特殊优先
- scoped test 通过

## Steps

### Step 1: Align picker with protocol
- [x] 移除 `"index"` 特判
- [x] 让默认入口回落到 `templateFiles[0]`
- **Verification:** unit test 证明多入口示例默认取首个 template

### Step 2: Regression verification
- [x] 跑 scoped example-artifact tests
- [x] 检查现有单入口行为未回归
- **Verification:** `pnpm --dir lynxtron-go test src/app/example-artifact.test.ts`

## Notes

- 真实 crash 日志显示：`external-bundle` 当前被默认运行为 `dist/index.lynx.bundle`
- 发布站点 metadata 的 `templateFiles` 顺序是 `comp`, `index`, `lodash-es`, `react`
- 协议文档写明没有显式 default entry 时，应退回 `templateFiles[0]`
- 对 `comp/react/lodash-es` bundle 做字符串检查时，未见 `fetchBundle` / `unpkg` 依赖；当前已知崩溃入口是 `index`
- 2026-04-08 verification:
  - `pnpm --dir lynxtron-go test src/app/example-artifact.test.ts`
  - 结果：`15 passed`
