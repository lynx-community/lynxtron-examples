# 2026-04-10 — Showcase Local Start / Dev Baseline

## Goal

把 desktop showcase 的本地 `start` / `dev` 能力从“已有脚本”提升为正式产品与交付基线，避免后续新增 showcase 时再次变成隐式约定。

## Scope

- 确认当前现有 desktop showcase 是否已具备本地 `start` / `dev`
- 将该能力写入产品计划与 workflow
- 不在本任务中新增新的 host/runtime 代码

## Current Verification

当前仓库中已具备如下本地脚本：

- `lynxtron-go`
  - `dev`
  - `start`
- `showcases/counter`
  - `dev`
  - `start`
- `showcases/benchmark`
  - `dev`
  - `start`
- `showcases/cross-platform-notes`
  - `dev`
  - `start`
- `showcases/native-texture-canvas`
  - `dev`
  - `start`
- `showcases/pc-mouse-cursor`
  - `dev`
  - `start`

验证方式：

- 代码与脚本检查：
  - 根 `package.json`
  - 各 showcase / `lynxtron-go` 的 `package.json`

## Acceptance

- `product-plan` 明确把 `pnpm start` / `pnpm dev` 记为 desktop showcase 的本地开发基线
- `workflow` 明确要求后续新增或重构 desktop showcase 时默认提供这两个脚本，若缺失则必须记录原因
- 本次为 docs-only 收口，不要求额外 runtime 验证

## Status

- Accepted
