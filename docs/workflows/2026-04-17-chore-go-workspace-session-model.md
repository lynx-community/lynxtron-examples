# Task Handoff: GO Workspace Session Model Convergence
- Parent workflow: `docs/workflows/2026-04-17-chore-go-architecture-stabilization.md`
- Created: 2026-04-17
- Status: accepted

## Objective

实现架构整治 Step 1：收敛 Lynxtron GO 中和 workspace 相关的并行状态，把“主视图导航语义”和“workspace/run 语义”统一到一个可解释的领域模型上。

当前已知问题不是单一 bug，而是以下状态并行存在并互相推断：

- `route`
- `ideMode`
- `rootPath`
- `lastWorkspacePath`

这会让 deep-link、example artifact、showcase run 和 resume workspace 的行为持续增加维护成本。

## Scope

本任务只处理 **app-side workspace session model**，不处理：

- `preload.ts` service 拆分
- packaged deep-link smoke
- `main.ts` host 事件流大改
- `App.tsx` 的完整组件拆层

允许做的事情：

- 新增或替换 shared model/helper
- 在 `App.tsx` 中把现有并行状态改为以单一 workspace session 为中心
- 调整相应 unit tests / focused tests

## Owned Files

优先把改动限制在以下文件集合：

- `lynxtron-go/src/app/App.tsx`
- `lynxtron-go/src/app/shared/navigation.ts`
- `lynxtron-go/src/app/shared/ide-mode.ts`
- `lynxtron-go/src/app/shared/`
  - 可以新增一个 `workspace-session.ts` 或等价 helper 文件
- `lynxtron-go/src/app/example-artifact.test.ts`
- `lynxtron-go/src/app/shared/deep-link-*.test.ts`

尽量不要触碰：

- `lynxtron-go/src/main/desktop/main.ts`
- `lynxtron-go/src/main/desktop/preload.ts`
- `lynxtron-go/src/app/components/**`

如果必须改组件 props，保持改动最小，并在回报中说明原因。

## Frozen Product Decisions

以下语义在本任务内视为冻结：

- route 只负责主视图状态，不能直接决定 run 语义
- run 目标必须来自显式 workspace/session 模型，而不是由 `route.kind === 'workspace'` 之类的条件临时推断
- showcase / folder / example-artifact 三类 workspace 必须继续保留清晰区分
- example artifact 沿用现有 `templateFile + title + cachePath` 运行语义

## Recommended Target Shape

命名可以调整，但最终语义必须等价于下面这组模型关系：

```ts
type WorkspaceSession =
  | {
      kind: 'folder';
      rootPath: string;
      activeFile?: string;
    }
  | {
      kind: 'showcase';
      rootPath: string;
      activeFile?: string;
    }
  | {
      kind: 'example-artifact';
      rootPath: string; // same as cachePath for app-side tree/rendering
      activeFile?: string;
      cachePath: string;
      templateFile?: string;
      title: string;
    };

type AppRoute =
  | { kind: 'home' }
  | {
      kind: 'workspace';
      source: WorkspaceSession['kind'];
      rootPath: string;
      activeFile?: string;
    };
```

关键要求：

- `AppRoute` 可以从 `WorkspaceSession` 派生，而不是各自独立维护
- `resolve...RunTarget(...)` 应直接吃新的 workspace/session 模型，而不是继续吃旧 `IdeWorkspaceMode`
- `lastWorkspacePath` 如仍保留，只能作为 resume/fallback 数据，不应继续是 workspace 主状态源

## Acceptance Target

- `App.tsx` 中至少去掉一组核心并行状态源，形成以 workspace session 为中心的读写路径
- 新模型能覆盖：
  - `openFolder(...)`
  - `openShowcaseEntry(...)`
  - `openExampleArtifactWorkspace(...)`
  - `handleResumeWorkspace()`
  - `handleRunCurrentWorkspace()`
- deep-link readiness / dispatch 相关 helper 仍然能解释 showcase/example 两类 workspace 行为
- 测试中能直接证明：
  - 三类 workspace session 到 route 的映射
  - 三类 workspace session 到 run target 的映射
  - example-artifact 的无 template 场景不会被误判成 showcase run

## Verification

至少完成以下验证：

- `pnpm --dir lynxtron-go exec vitest run src/app/example-artifact.test.ts`
- `pnpm --dir lynxtron-go exec vitest run src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`
- 如果新增了独立 model test，必须一起跑

如实现范围允许，再补：

- `pnpm --dir lynxtron-go build`

如果 build 或 smoke 没跑，必须在交付说明中写明是“本任务刻意不涉及”还是“被阻塞”。

## Non-Goals

- 不要求本任务内把 `App.tsx` 拆成多个组件文件
- 不要求替换 QuickPicker / GalleryHome / IDE 的现有交互设计
- 不要求把 `route` 变成浏览器式 router
- 不要求把 host deep-link 全链路一起重做

## Delivery Note Format

交付回报至少包含：

- 改了什么模型
- 为什么这个模型比原先状态组合更稳定
- 改了哪些文件
- 跑了哪些验证，结果如何
- 哪些 follow-up 被刻意留给 Step 2 / Step 4

## PM Review Focus

PM 审查会重点看：

- 是否真的减少了并行状态，而不是换了一个名字继续并行
- run 语义是否仍然显式，而不是又从 route 反推
- example-artifact 行为是否被错误压平到 showcase/folder 模型里
- 改动是否保持在 Step 1 范围，没有偷跑到 `preload.ts` 或 packaged deep-link

## History

- 2026-04-17: Handoff drafted and frozen as the execution boundary for architecture stabilization Step 1
- 2026-04-17: Step 1 implementation slice dispatched with bounded ownership on app-side model files and focused tests only
- 2026-04-17: First implementation returned with the core `WorkspaceSession` model and focused verification passing
- 2026-04-17: PM review result is `follow-up needed`, because `WorkspaceSession.activeFile` is modeled but not yet maintained through `openFile / switchTab / closeTab`, so active-file ownership is still split between tabs state and the new session model
- 2026-04-17: Follow-up implemented active-file synchronization for `openFile / switchTab / closeTab`, and PM independently re-verified the scoped tests plus `pnpm --dir lynxtron-go build`
- 2026-04-17: PM final review result is `accepted` for Step 1
