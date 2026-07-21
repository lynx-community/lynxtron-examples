# Fix: Showcase TS Diagnostic False Positives
- Branch: feat/monorepo-architecture
- Created: 2026-04-08
- Status: runtime-smoke-passed-pending-lynxtron-release-rollout

## Goal

修复 Lynxtron GO 中针对 showcase / workspace 文件的 TypeScript diagnostics 假阳性问题。

当前现象是：

- showcase 中部分 `tsx` 文件在编辑器里出现红色波浪线
- 但对应 showcase 的实际构建可以通过
- 部分 `main.ts` / `web-host.ts` 也会在 IDE 中出现与真实运行环境不一致的错误

本任务目标不是“关闭 diagnostics”，而是让 IDE 的 diagnostics 尽量贴近项目真实语义。

## 2026-04-10 Implementation Update

- 已新增共享 slice 配置：
  - `showcases/tsconfig.app.json`
  - `showcases/tsconfig.web.json`
  - `showcases/tsconfig.desktop.json`
- 已为现有 showcase 的 `src/app`、`src/main/web`、`src/main/desktop` 补齐显式 `tsconfig.json`
- 已修正 slice `tsconfig.json` 中 `extends` 的相对路径错误，避免配置文件表面存在但实际未生效
- `TypeScriptLanguageService` 已改为通过 `ts.getParsedCommandLineOfConfigFile(...)` 读取项目配置，确保 `extends`、`include`、共享模板编译选项都被真实展开
- 对 `types: ["node"]` 的项目增加了 pnpm workspace 场景下的 `typeRoots` 发现逻辑，避免 `@types/node` 仅存在于 `.pnpm` 布局时 host slice 误报 `path` / `__dirname`
- 已新增 focused regression tests，覆盖：
  - showcase app `tsx` 不再误报 JSX runtime
  - showcase desktop host `main.ts` 不再误报 Node host 基础类型
  - showcase web host 能正确消费 ambient `.d.ts`

## 2026-04-14 Runtime Resolution Update

- 已确认 desktop host runtime blocker 的根因不在 `lynxtron-go` diagnostics 逻辑本身，而在 Lynxtron mac app bundle 的 ICU 数据打包：
  - app bundle 使用了 `third_party/icu/flutter/icudtl.dat` 的精简数据
  - framework bundle 未同时携带 `Resources/icudtl.dat`
  - 运行态表现为 `Intl.Collator` / `String.localeCompare(...)` 在 run-as-node / extension-host 路径下抛 `RangeError: Internal error. Icu error`
- 已在 Lynxtron 仓库提交对应修复：
  - repo: `/Users/bytedance/ws2/lynxtron_oss_ws/lynxtron`
  - commit: `c20cf1b`
  - subject: `[Fix] Bundle full ICU data in mac app`
- 已用该提交产出的 `lynxtron.app` 覆盖本地 `node_modules/@lynx-js/lynxtron` 二进制进行验证：
  - `Contents/Resources/icudtl.dat` 为完整 `10M` 数据
  - `Contents/Frameworks/Lynxtron Framework.framework/Resources/icudtl.dat` 为完整 `10M` 数据
- 用户已确认 GUI 手工 smoke 跑通

## 2026-04-14 Packaging Follow-up

- 已确认 `benchmark` 在下载后的真实 workspace 中仍会出现 `TS2875 react/jsx-runtime`，根因不是 language service fallback 再次回归，而是分发产物中的 slice `tsconfig.json` 仍然依赖 monorepo 外部共享模板：
  - `src/app/tsconfig.json -> ../../../tsconfig.app.json`
  - `src/main/desktop/tsconfig.json -> ../../../../tsconfig.desktop.json`
- showcase 被解压到 `~/.lynxtron-go/showcases/<name>` 后，这些 `extends` 目标并不存在，因此 `ts.getParsedCommandLineOfConfigFile(...)` 无法拿到有效项目配置。
- 工程约束已调整为：
  - showcase 的 `src/app` / `src/main/desktop` / `src/main/web` slice `tsconfig.json` 必须是 package-local self-contained config
  - 不允许依赖包外共享模板路径
  - 若后续保留 monorepo 级模板，只能作为生成源，不得作为分发后 workspace 的运行时依赖
- 同时，`TypeScriptLanguageService` 已补 official-toolchain fallback：
  - 未 install 的 fetched showcase 也会优先兜底解析 `@lynx-js/react`、`@lynx-js/types`、`@lynx-js/rspeedy`、`@rspack/*`、`@lynx-js/lynxtron*`
  - quick verify 场景不再依赖先跑 `pnpm install`
  - 非官方第三方依赖仍以真实 install 结果为准

## Current Verification

- `pnpm --dir lynxtron-go exec vitest run src/extension-host/__tests__/typescript.test.ts src/extension-host/__tests__/css.test.ts src/app/diagnostics.test.ts`
  - 通过，42/42
- `pnpm --dir showcases/counter build`
  - 通过
- `pnpm --dir showcases/cross-platform-notes build`
  - 通过
- 真实 Lynxtron GO 运行态 smoke 已通过：
  - example workspace 默认文件打开不再出现 `setText failed`
  - 使用替换后的 `node_modules` Lynxtron 二进制启动 `lynxtron-go/dist/desktop`
  - 在运行中的 GUI preload bridge 中直接调用 `ls.updateFile()` / `ls.getDiagnostics()` 后：
    - `showcases/counter/src/main/desktop/main.ts` 返回 `0 markers`
    - `showcases/counter/src/app/App.tsx` 返回 `0 markers`
  - `/tmp/lynxtron_debug.log` 已记录：
    - `Received diagnostics for .../showcases/counter/src/main/desktop/main.ts: 0 markers`
    - `Received diagnostics for .../showcases/counter/src/app/App.tsx: 0 markers`
  - 该过程中未出现新的 `ExtHost exited`
- 用户已补完 GUI 手工 smoke，确认本地替换二进制后的整条链路可用

## Remaining Gap

- 当前主目标已达成，剩余项不再是 diagnostics 技术 blocker，而是运行时版本滚动：
  - `lynxtron-go` 当前验证依赖本地替换后的 `node_modules` Lynxtron 二进制
  - 需要让 Lynxtron commit `c20cf1b` 进入正式的 `@lynx-js/lynxtron` 包版本，取消人工替换
- `@lynx-js/lynxtron` 根 export typing 的上游问题仍应继续独立跟踪，但它已不再阻塞本任务的最小 runtime 验收

## Runtime Smoke Update

- 复现环境：
  - `pnpm --dir lynxtron-go build`
  - `/Users/bytedance/ws2/lynxtron_oss_ws/out/Release/lynxtron.app/Contents/MacOS/lynxtron /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go/dist/desktop`
  - 使用 Lynx DevTool + `__ide_debugOpenExampleArtifactRoute('view')` 进入 workspace
- 已验证通过：
  - example workspace 默认文件不再触发 `setText failed`
  - 打开 [showcases/counter/src/app/App.tsx](/Users/bytedance/ws2/lynxtron-show-cases/showcases/counter/src/app/App.tsx) 后，runtime diagnostics 为 `0 markers`
- blocker 已解决：
  - 打开 [showcases/counter/src/main/desktop/main.ts](/Users/bytedance/ws2/lynxtron-show-cases/showcases/counter/src/main/desktop/main.ts) 时，不再出现 extension host 崩溃
  - root cause 已确认为 Lynxtron mac app bundle ICU 数据缺失，而非 diagnostics 代码路径错误
  - 本地替换后的 Lynxtron 二进制已在真实运行态返回 `0 markers`

## Reproduced Facts

- [showcases/counter/src/app/App.tsx](/Users/bytedance/ws2/lynxtron-show-cases/showcases/counter/src/app/App.tsx) 在当前 TS language service fallback 配置下可复现 `TS2875`
  - `This JSX tag requires the module path 'react/jsx-runtime' to exist`
- [showcases/cross-platform-notes/src/app/App.tsx](/Users/bytedance/ws2/lynxtron-show-cases/showcases/cross-platform-notes/src/app/App.tsx) 可复现相同问题
- [showcases/counter/src/main/desktop/main.ts](/Users/bytedance/ws2/lynxtron-show-cases/showcases/counter/src/main/desktop/main.ts) 在 IDE diagnostics 下会报 Node 类型与宿主 API 签名相关错误
- [showcases/cross-platform-notes/src/main/web/web-host.ts](/Users/bytedance/ws2/lynxtron-show-cases/showcases/cross-platform-notes/src/main/web/web-host.ts) 会报 `window.__CROSS_PLATFORM_NOTES__` 不存在，尽管仓库里已有 [showcases/cross-platform-notes/src/main/web/global.d.ts](/Users/bytedance/ws2/lynxtron-show-cases/showcases/cross-platform-notes/src/main/web/global.d.ts)
- `showcases/counter` 的 `pnpm build` 已验证通过，说明“IDE 误报”与“构建通过”可以同时成立

## Repro Matrix

| Slice | Example File | Current IDE diagnostics | What is missing today | Candidate config result |
|---|---|---|---|---|
| showcase app | `showcases/counter/src/app/App.tsx` | `TS2875 react/jsx-runtime` | 缺少 `jsxImportSource: @lynx-js/react`，且未按 app 项目语义建 program | JSX runtime 假阳性消失，仅剩与代码严格度相关的 `implicit any` |
| showcase app | `showcases/cross-platform-notes/src/app/App.tsx` | `TS2875 react/jsx-runtime` | 同上 | 预期同 `counter` app |
| showcase desktop host | `showcases/counter/src/main/desktop/main.ts` | `path` / `__dirname` / host API 签名误报 | 缺少 host 专属 compiler options；Node 类型上下文未稳定建立；另有 upstream package typing 问题 | Node 语义可部分收敛，但 `@lynx-js/lynxtron` root export typing 仍是外部阻塞 |
| showcase web host | `showcases/cross-platform-notes/src/main/web/web-host.ts` | `window.__CROSS_PLATFORM_NOTES__` 不存在 | ambient `.d.ts` 未按项目 `include` 进入 program | 在 `web` slice 建立完整 file set 后可归零 |

## Decision

当前建议采用 **组合方案**，而不是继续依赖单一 fallback：

1. 为 showcase 的不同 slice 补显式 `tsconfig`
2. TS diagnostics service 优先按这些显式 `tsconfig` 建立 project
3. program root 不能只依赖“当前打开文件”，必须把该 tsconfig `include` 覆盖到的 `.ts` / `.tsx` / `.d.ts` 纳入

原因：

- `@lynx-js/react` 与 `@lynx-js/types` 本身提供了正确的 JSX runtime 与 `IntrinsicElements`
- 当前误报主要来自 **没有把正确项目配置喂给 TypeScriptLanguageService**
- 只增强 fallback 推导很容易继续漏掉 ambient `.d.ts`、host / web 分流和未来新增 showcase 的一致性

推荐的 source-of-truth：

- `showcases/<name>/src/app/tsconfig.json`
- `showcases/<name>/src/main/desktop/tsconfig.json`
- `showcases/<name>/src/main/web/tsconfig.json`（存在 web host 时）

这些 tsconfig 的职责是：

- 服务 IDE diagnostics / type context
- 作为各 slice 真实语义的显式声明
- 不强制改变现有 `rspeedy` / `rspack` 构建链路

## Proposed Minimal Templates

当前推荐先采用“最小噪音模板”，优先消除假阳性，不顺手把 showcase 全部拉进严格类型收敛。

### Showcase app

目标：

- 消除 `react/jsx-runtime` 假阳性
- 让 Lynx JSX intrinsic elements 按 `@lynx-js/types` 生效
- 不因为 `strict` 引入一批与当前任务无关的 `implicit any`

建议模板：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@lynx-js/react",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": false,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["@lynx-js/types"]
  },
  "include": ["./**/*.ts", "./**/*.tsx"]
}
```

当前本地验证结果：

- `showcases/counter/src/app/App.tsx` 在该模板下 diagnostics 降为 `0`
- `showcases/cross-platform-notes/src/app/App.tsx` 预期同类收敛

### Showcase web host

目标：

- 把 `global.d.ts` 这类 ambient declaration 纳入 program
- 消除 `window.__XXX__` 这一类全局增强误报

建议模板：

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2023", "DOM"],
    "strict": false,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  },
  "include": ["./**/*.ts", "./**/*.d.ts"]
}
```

当前本地验证结果：

- `showcases/cross-platform-notes/src/main/web/web-host.ts` 在该模板下 diagnostics 降为 `0`

### Showcase desktop host

目标：

- 至少为 Node host 提供单独 slice 配置
- 不再与 Lynx app / web host 共享错误的 fallback 语义

建议先尝试：

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": false,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["./**/*.ts"]
}
```

当前本地验证结果：

- 已能把 host 语义和 app / web slice 拆开
- 但 `path` / `__dirname` 仍未在当前 TypeScriptLanguageService 实验环境中完全消除
- 其中 `@lynx-js/lynxtron` typing 暴露问题已确认为独立外部 blocker

因此 desktop host 在本轮中的接受标准可以定义为：

- 先接入独立 tsconfig slice
- 明确区分“本仓库可修复误报”和“上游包 typing 问题”
- 不要求一次性把 host diagnostics 清零

## Recommended Implementation Boundary

本轮最小实现建议只覆盖：

- 为 showcase app / desktop / web slice 建立显式 tsconfig
- 让 `TypeScriptLanguageService` 优先发现并使用这些 tsconfig
- 让 program root 包含 tsconfig `include` 覆盖到的 `.ts` / `.tsx` / `.d.ts`
- 补 focused tests，覆盖：
  - app `tsx` JSX runtime 误报消失
  - web ambient `.d.ts` 误报消失
  - desktop host 独立 slice 被识别，且外部 blocker 被明确隔离

本轮不建议顺手做：

- 仓库级 `tsconfig.base.json` 重构
- showcase 全量 strict 收敛
- 修复 `@lynx-js/lynxtron` 上游包 exports typing
- 重写整个 TS project graph 管理器

## Implementation Handoff

### Owned files

- `lynxtron-go/src/extension-host/language-server/typescript.ts`
- `lynxtron-go/src/extension-host/__tests__/typescript.test.ts`
- `showcases/*/src/app/tsconfig.json`
- `showcases/*/src/main/desktop/tsconfig.json`
- `showcases/*/src/main/web/tsconfig.json` for showcases that actually have web host files

### Expected behavior changes

- `showcases/*/src/app/*.tsx` 不再误报 `react/jsx-runtime`
- `showcases/*/src/main/web/*.ts` 能消费同目录 ambient `.d.ts`
- diagnostics project 不再只由“打开文件集合”定义

### Non-goals for the implementation worker

- 不修 packaged build
- 不改 showcase 构建脚本
- 不因为清理 diagnostics 而关闭全部 semantic diagnostics
- 不把 desktop host 的 upstream typing 问题伪装成“已彻底解决”

## External Blocker

desktop host 方向还有一个独立外部问题：

- `@lynx-js/lynxtron` 包虽然在 `package.json` 里声明了 `types`
- 但根 `exports` 的 `.` 只导出 JS 入口，没有显式导出 types
- 在尊重 `package.json exports` 的解析模式下，TS 会报 root entry typing 不可见

这部分已单独记入 `docs/lynxtron-framework-issues.md`，不应和 showcase app / web 的 tsconfig 问题混为一谈。

## Current Cause Hypothesis

当前实现中，TypeScriptLanguageService 在找不到就近 `tsconfig.json` 时会退回默认编译选项：

- `module: CommonJS`
- `moduleResolution: NodeJs`
- `jsx: ReactJSX`
- 未设置 `jsxImportSource`
- 未注入 Node `types`

同时，language service 当前的 root file 集合主要来自“已打开 / 已更新的文件”，没有按项目 `tsconfig include` 自动纳入 ambient `.d.ts` 和其他项目文件。

这会导致三类偏差：

- Lynx UI `tsx` 被按标准 React JSX runtime 解释，错误要求 `react/jsx-runtime`
- desktop host `ts` 文件缺少 Node 类型和真实宿主环境上下文
- web host 的 ambient `.d.ts` 未进入 program，导致全局声明丢失

## Product Definition

本次修复要让 IDE diagnostics 更接近“当前文件所在子项目的真实语义”。

至少需要覆盖三类 workspace 文件：

- showcase `src/app/**/*.ts(x)`
- showcase `src/main/desktop/**/*.ts`
- showcase `src/main/web/**/*.ts`

本次不做：

- 完整 LSP 架构重写
- 一次性补齐 hover / definition / completion 的全部项目级语义
- 为所有未来语言先设计一个过度抽象的 project system

## Acceptance Target

- showcase 的 Lynx UI `tsx` 文件不再因错误的 JSX runtime 假报 `react/jsx-runtime` 类错误
- showcase 的 desktop host 文件在 IDE 中具备最小正确的 Node 类型上下文
- 像 `global.d.ts` 这类 ambient 声明能够按项目语义进入 diagnostics program
- 现有 `lynxtron-go` 自身 diagnostics 行为不被回归破坏
- 修复后至少有一个 showcase app 文件、一个 host 文件、一个 ambient declaration 场景得到 focused 验证

## Steps

### Step 1: Freeze repro matrix
- [x] 记录最小可复现文件与报错类型
- [x] 确认“build 通过但 IDE diagnostics 误报”可以稳定复现
- [x] 补一份最小 repro matrix，明确 app / desktop / web 三类文件分别受哪些配置缺失影响
- **Verification:** 文档和命令输出可支撑后续实现边界，不再停留在主观描述

### Step 2: Decide project model
- [x] 决定修复路径是“为 showcase 补显式 tsconfig”还是“增强 TS service 的项目发现与 fallback 分层”，或两者组合
- [x] 明确 app / desktop / web 三类文件各自应采用的 compiler options 来源
- [x] 明确 ambient `.d.ts` 如何进入 program
- **Verification:** PM review 后能明确文件归属规则、配置来源和非目标

### Step 3: Implement in bounded scope
- [ ] 派发 subagent 实现最小修复
- [ ] 变更范围控制在 TS diagnostics 相关代码与必要项目配置，不顺手扩散到无关 IDE 功能
- [ ] 如需新增 showcase tsconfig，要求模式统一且可复用
- [ ] 实现优先级先 app / web，再 desktop host best-effort
- **Verification:** scoped test/build 至少覆盖一条 diagnostics 关键路径

### Step 4: Focused regression verification
- [ ] 用真实 showcase 文件复跑 diagnostics，确认误报消失
- [ ] 回归 `lynxtron-go` 自身 app / host diagnostics 未被破坏
- [ ] 若涉及新 tsconfig 或 program root 规则，至少复核一个 ambient declaration 场景
- **Verification:** 至少一条 test/build 证据 + 一条基于真实文件的 diagnostics 对比证据

### Step 5: Docs closeout
- [ ] 更新 `status-log` 与必要的计划文档
- [ ] 记录剩余风险，例如仍未覆盖的 workspace 类型或运行时特有 API
- **Verification:** PM 验收通过，文档状态同步完成

## Verification Rules

- 属于 IDE / diagnostics / shared infra 修复，至少要求 scoped test 或 build 加 focused repro 验证
- 不接受简单屏蔽 diagnostics 或按字符串过滤报错文案的方案
- 如果修改 TS project 发现逻辑，必须明确回归 `lynxtron-go` 自身文件
- 如果引入新的 `tsconfig` 文件，必须说明它与 `rspeedy` / `rspack` / 当前构建链路的关系，避免制造新的配置歧义

## Open Questions

- 是否让所有 showcase 都采用统一模板生成 `src/app/tsconfig.json` 与 `src/main/desktop/tsconfig.json`
- desktop host 的 `@lynx-js/lynxtron` typing 是否要在本仓库先做临时 shim，还是等待上游修复 exports/types
- `implicit any` 这类严格模式错误是否属于本轮“假阳性修复”范围，还是应单独作为后续 type hygiene 收敛

## Next Action

- 先按上面的模板和边界派发最小实现
- worker 先做 app / web 两类零误报收敛，再决定 desktop host 是否需要本地 shim
