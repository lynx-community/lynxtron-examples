# Task Handoff: GO Preload Service Modularization
- Parent workflow: `docs/workflows/2026-04-17-chore-go-architecture-stabilization.md`
- Created: 2026-04-17
- Status: accepted

## Objective

实现架构整治 Step 3：把 `lynxtron-go/src/main/desktop/preload.ts` 中混合的 bridge/service 职责拆成明确模块，同时保持导出的 BTS bridge contract 稳定。

当前单文件里同时包含：

- config / fs bridge
- extension host / diagnostics bridge
- PTY session 管理
- utils / search
- example artifact runtime
- showcase runtime / install / web launch

这已经超出单文件可持续维护范围。

## Scope

本任务只处理 preload service 模块化，不处理：

- app-side `App.tsx` shell 拆层
- host `main.ts` 事件流重构
- packaged smoke
- 运行语义改写

允许做的事情：

- 在 `lynxtron-go/src/main/desktop/` 下新增 service/helper 模块
- 让 `preload.ts` 收敛为装配入口
- 复用现有实现逻辑，避免顺手改变产品语义

## Owned Files

优先把改动限制在以下范围：

- `lynxtron-go/src/main/desktop/preload.ts`
- `lynxtron-go/src/main/desktop/*.ts`
- `lynxtron-go/src/main/desktop/**`

尽量不要触碰：

- `lynxtron-go/src/app/**`
- `lynxtron-go/src/main/desktop/main.ts`

## Frozen Product Decisions

- app 侧调用看到的 bridge contract 保持兼容
- 不在本任务内改变 showcase / example artifact 的 run 语义
- 不把 service 模块化扩成新的产品能力开发

## Recommended Service Split

命名可调整，但语义上至少要拆出这几类：

- config/fs/search 基础 bridge
- diagnostics / extension-host service
- PTY / process tracking service
- example artifact service
- showcase runtime service

## Acceptance Target

- `preload.ts` 明显缩小为装配入口或轻量 facade
- extension-host、PTY、showcase/example runtime 的职责不再直接堆在一个文件里
- BTS 导出接口保持现有 app 侧用法兼容
- 构建通过，且至少有一轮 focused verification 能证明关键链路没断

## Verification

至少完成以下验证：

- `pnpm --dir lynxtron-go build`

尽量补充以下验证之一：

- `pnpm --dir lynxtron-go exec vitest run src/app/example-artifact.test.ts`
- `pnpm --dir lynxtron-go exec vitest run src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`

如果没有补 focused test，回报中必须说明原因，并明确哪些链路仅靠 build 保护。

## Delivery Note Format

交付回报至少包含：

- 拆出了哪些 service 模块
- `preload.ts` 现在还保留哪些职责
- 改了哪些文件
- 跑了哪些验证
- 哪些风险或 follow-up 仍保留给 Step 4 或后续 runtime smoke

## PM Review Focus

- `preload.ts` 是否真的收敛为装配入口，而不是只移动少量代码
- app-visible bridge contract 是否保持兼容
- showcase/example/runtime 语义是否没有被顺手改写
- 是否避开了 app-side 和 host-side 不必要的跨层耦合

## History

- 2026-04-17: Handoff drafted after Step 1 acceptance, as the execution boundary for architecture stabilization Step 3
- 2026-04-27: Implementation landed locally by splitting `preload.ts` into foundation/config-store/log/extension-host/pty/example-artifact/showcase modules
- 2026-04-27: PM independently verified `pnpm --dir lynxtron-go build` and `pnpm --dir lynxtron-go exec vitest run src/app/example-artifact.test.ts`
- 2026-04-27: PM review result is `accepted`; `preload.ts` is now a thin BTS bridge assembly entry and app-visible contract stayed compatible
