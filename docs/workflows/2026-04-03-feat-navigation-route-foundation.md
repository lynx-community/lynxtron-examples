# Feature: Lynxtron GO Navigation / Route Foundation
- Branch: feat/monorepo-architecture
- Created: 2026-04-03
- Status: completed

## Goal

为 Lynxtron GO 引入一个轻量内部 route/navigation 模型，统一主视图切换，为后续 `lynxtron://` scheme 跳转和 UI 自动化提供稳定入口。

## Product Definition

该能力不是引入一个重型网页 router，而是定义 Lynxtron GO 的**主视图导航状态**。

第一版 route 只管理：

- `home`
- `workspace`

第一版不管理：

- tooltip
- quick picker
- loading overlay
- toast / status bar message
- history / back stack

建议的最小 route 形状：

```ts
type AppRoute =
  | { kind: 'home' }
  | {
      kind: 'workspace';
      source: 'folder' | 'showcase' | 'example-artifact';
      rootPath: string;
      activeFile?: string;
    };
```

## Acceptance Target

- Lynxtron GO 的主视图不再依赖零散布尔值切换 `home` 与 `workspace`
- `Open Folder`、`Open Showcase`、`Open Example Artifact` 至少有一条链路接入 route
- 代码中存在清晰的 navigation boundary，后续 scheme 或测试入口可以直接调用
- 不引入重型 router 依赖
- 不破坏当前 gallery、workspace、example artifact 已有行为

## Steps

### Step 1: Route model and navigation boundary
- [x] 新增 route 类型定义与集中导航入口
- [x] 收敛 `home` / `workspace` 主视图判断，不再散落在 `App.tsx` 多个布尔值中
- [x] 明确 route 与 transient UI state 的边界
- **Verification:** 类型和主切换逻辑可读，`home` 与 `workspace` 能通过 route 决定

### Step 2: Migrate one real entry path
- [x] 至少将一条真实入口接到 route，例如 `Open Example Artifact`
- [x] 行为与当前实现保持一致
- **Verification:** 真实链路仍可进入 workspace，且 route 状态正确变化

### Step 3: Test / debug entry
- [x] 增加一个最小测试或调试入口，可不依赖键盘注入直接进入目标 route
- [x] 为后续 scheme / UI 自动化预留入口
- **Verification:** 可用受控方式直接进入指定 route

### Step 4: Docs and follow-up planning
- [x] 将 route 基础层写回计划文档和状态文档
- [x] 记录下一步 scheme 映射与自动化验证的接入方向
- **Verification:** PM 验收通过，文档状态同步完成

## Verification Rules

- 属于 Product UI / state 变更，至少要求 scoped build + focused smoke
- 涉及 Lynx UI / 样式实现时，必须参考 `https://lynxjs.org/llms.txt`
- 不接受“只重命名状态变量”的伪重构；必须形成清晰 navigation boundary
- 若改动影响 Example Artifact、Showcase 或 Folder 打开链路，必须至少回归其中一条真实路径

## Notes

- 目标是 **navigation model**，不是完整 router framework
- 该能力的价值在于 scheme 跳转、自动化验证、主视图统一，而不是浏览器 URL/history 语义

## History

- 2026-04-03: Step 1 completed and committed as `34a0634`
- 2026-04-03: Step 2 accepted after review; `Open Example Artifact` is routed through the new navigation boundary and still opens the temporary workspace with the default file
- 2026-04-03: Step 3 accepted after adding a controlled debug entry for direct example route entry, usable without keyboard injection
- 2026-04-03: Step 4 completed after syncing docs and follow-up direction; next route work is scheme mapping and automation entry wiring on top of the current foundation
