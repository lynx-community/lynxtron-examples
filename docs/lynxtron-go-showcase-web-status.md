# Lynxtron GO Showcase Web Status

## 2026-05-09 Complete Cross-Platform Notes Implementation

### Active Task

按预期功能补齐 `showcases/cross-platform-notes` demo，并完成 PM 验收。

### Progress

- 已补齐 standalone web 自包含运行路径：
  - `start:web` 不再依赖未声明的 `npx serve`
  - 新增 showcase 内置 Node static server
  - server 输出 COOP / COEP headers，满足 Lynx Web 资源运行所需的 cross-origin isolation 基线
- 已补齐共享 UI 行为：
  - shared app TypeScript diagnostics 归零
  - dirty state 同时覆盖 title 和 content
  - title/content 编辑会在约 500ms 后 autosave
  - 新建/切换笔记前会先 flush 当前 dirty note，避免 debounce 尚未触发时丢编辑
  - explicit Save 按钮保留
- 已补齐 showcase 文档：
  - `showcases/cross-platform-notes/README.md`
- PM runtime review 发现并修复了 desktop 布局问题：
  - note list 与 editor 已恢复为预期双栏布局
- Web 版本布局问题已通过升级 Lynx Web 相关工具链修复：
  - 移除了临时注入 Lynx Web 基础 CSS 的 workaround
  - 业务样式中保留显式 `display: flex`，符合当前 app 对双栏 / 纵向布局的真实需求
- 共性工具链依赖版本已集中到 `pnpm-workspace.yaml` catalog：
  - workspace 内相关 package 改为 `catalog:` 引用
  - 避免 shared config 与各 showcase 的 Lynx Web / React / Rspeedy 版本再次漂移

### Verification

- `pnpm install --frozen-lockfile`：完成；本地 `@lynx-js/lynxtron` 从 stale `3.9.1-alpha.0-oss` 对齐到 lockfile 的 `4.0.0-alpha.2-oss`
- `pnpm ignored-builds`：None
- `pnpm --dir showcases/cross-platform-notes exec tsc --noEmit -p src/app/tsconfig.json`：通过
- `pnpm --dir showcases/cross-platform-notes run build`：通过
- `pnpm --dir showcases/cross-platform-notes run build:web`：通过
- `pnpm --dir showcases/cross-platform-notes run start:web`：通过；本地 server 启动到 `http://127.0.0.1:4173`
- `curl -I` 验证通过且包含 COOP / COEP：
  - `/`
  - `/main.web.bundle`
  - `/__lynx_web__/static/js/index.js`
- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts src/main/desktop/showcase-install.test.ts`：25 tests passed
- `pnpm --dir lynxtron-go build`：通过；仍有已知 `preload-lynxtron-runtime.ts` dynamic require warning
- Standalone desktop runtime smoke：
  - `pnpm --dir showcases/cross-platform-notes run start`
  - Lynx DevTool connected to `cross-platform-notes`
  - DOM confirmed `notes-root`, note list, editor inputs, platform footer
  - screenshot confirmed expected two-column note list + editor layout
  - page console error/warning list empty
- Standalone browser visual smoke：
  - `pnpm --dir showcases/cross-platform-notes run start:web`
  - DevTools confirmed `.notes-root` / `.notes-sidebar` / `.notes-editor` computed as column and `.notes-shell` as row
  - screenshot confirmed expected two-column Web layout
- `pnpm --filter benchmark run build`：通过，确认旧 showcase 不再触发 `@lynx-js/react/hooks` exports mismatch
- `pnpm preview:build`：通过

### Remaining Risk

- 尚未完成 Lynxtron GO 内部 `Run on Web / Debug on Web` 点击链路 smoke；当前通过 GO command tests / build 证明接线未破坏。
- runtime 仍输出已知 framework registry errors（例如 `MainPartsDelegate not found in registry`），但本次 desktop app 已正常渲染并可被 DevTool 检查。

### Next Action

- 后续单独做 GO `Run on Web / Debug on Web` runtime smoke；若失败，应归到 GO Web action 集成链路，而不是 `cross-platform-notes` showcase 本体。

## 2026-05-09

### Active Task

评估 `showcases/cross-platform-notes` demo 的当前可演示状态，并校正 `lynxtron-go` Web showcase 状态认知。

### Progress

- `cross-platform-notes` 当前不是空 scaffold：
  - `package.json` 已声明 `targets: ["desktop", "web"]`
  - `showcase-registry.json` 已包含 `cross-platform-notes` 的 desktop + web target
  - 共享 Lynx UI、desktop preload 文件存储、web localStorage adapter 均已存在
  - `dist/desktop`、`dist/web` 和 `cross-platform-notes-0.0.1.tgz` 均存在，tarball 内包含 desktop/web dist 与 web platform static assets
- `lynxtron-go` 当前代码已经超过 2026-04-17 文档状态：
  - host bridge 已暴露 `getTargets`、`isWebBuilt`、`needsWebSourceRun`、`runWeb`、`startWeb`、`devWeb`
  - Gallery、command palette、Run menu 均已有 Web action 接线
  - `lynxtron-go/dist/desktop/showcase-web-server.js` 可由 build 产出
- 结论调整：
  - demo 本体：可构建，可作为 desktop + web 多目标 showcase 基线
  - built web 分发路径：本地静态 server 可达
  - 完整用户级验收：仍缺真实 browser UI smoke、desktop runtime smoke、GO 内点击 `Run on Web / Debug on Web` smoke

### Verification

- `pnpm --dir showcases/cross-platform-notes run build`：通过
- `pnpm --dir showcases/cross-platform-notes run build:web`：通过
- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts src/main/desktop/showcase-install.test.ts`：25 tests passed
- `pnpm --dir lynxtron-go build`：通过；仍有 `preload-lynxtron-runtime.ts` 的已知 dynamic require warning
- `node lynxtron-go/dist/desktop/showcase-web-server.js showcases/cross-platform-notes/dist/web`：本地 server 可启动
- `curl -I` 验证通过：
  - `/`
  - `/main.web.bundle`
  - `/__lynx_web__/static/js/index.js`
- `pnpm --dir showcases/cross-platform-notes exec tsc --noEmit -p src/app/tsconfig.json`：失败，`App.tsx` 中两个 `<input value=...>` 与当前 `InputProps` 类型不匹配
- `pnpm --dir showcases/cross-platform-notes exec serve --version`：失败，`serve` 未安装

### Blockers / Risks

- `start:web` 使用 `npx serve ./dist/web`，但 `serve` 未在 showcase 依赖中声明；source web 路径不够自包含。
- shared app TS 诊断不干净，当前问题是 Lynx `InputProps` 类型不接受 `value` 属性。
- 当前 UI 是手动保存，不满足早期设计文档中的 autosave debounce 验收。
- `title` 变更没有计入 dirty 状态，只有 `content !== savedContent` 会影响按钮文案。
- 仍缺 side-by-side screenshot comparison，无法证明 desktop/web 视觉一致性。
- `showcases/cross-platform-notes` 根目录缺 `README.md`，缩略图是 `thumbnail.svg`，与早期标准交付物里的 `README.md` / `thumbnail.png` 不完全一致。

### Next Action

- 优先修补 source web 路径的自包含性：把 `serve` 显式纳入依赖，或统一改用 GO 内置 `showcase-web-server`。
- 修补 shared UI 的 Lynx 类型诊断，并决定是否恢复 autosave debounce。
- 做三段 smoke：
  - standalone desktop runtime
  - standalone web browser UI
  - GO 内 `Run on Web / Debug on Web`
- smoke 通过后再把 `cross-platform-notes` 标记为完整可演示状态。

## 2026-04-17

### Active Task

为 `lynxtron-go` 的多目标 showcase 能力建立一套与当前实现一致的 PM 文档基线。

### Progress

- 已确认当前工作区的主线不再是 `local runtime`，而是：
  - showcase `targets`
  - `Run on Web`
  - `Debug on Web`
- 已确认旧的 `local-runtime` 草稿不适合作为当前 feature 文档基线，原因是：
  - 目标描述的是本地 runtime 联调
  - 方案描述的是 desktop `Run / Debug`
  - 没有覆盖 `targets`、built web、source web、browser / server 语义
- 已新建当前 feature 对应的文档：
  - `docs/lynxtron-go-showcase-web-goal.md`
  - `docs/lynxtron-go-showcase-web-plan.md`
  - `docs/lynxtron-go-showcase-web-workflow.md`
  - `docs/lynxtron-go-showcase-web-status.md`
- 已完成当前阶段代码收敛：
  - 保留 `targets` / registry / showcase 声明建模
  - 撤回未闭环的 Gallery / command / menu `Run on Web / Debug on Web`
  - 撤回未接线的 `showcase-web-server` 构建入口
- 已识别当前代码状态：
  - `preload.ts` 尚未补齐 Web showcase API
  - 当前工作区中已不再暴露用户可见的 Web 动作，等待 host-first 重写

### Verification

- docs + scoped code rollback
- 已核对：
  - 当前工作区 diff
  - `docs/project-goal.md`
  - `docs/product-plan.md`
  - `docs/workflow.md`
  - `docs/workflows/2026-04-10-feat-go-ide-showcase-start-dev.md`
- 已验证：
  - `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts`
  - `pnpm --dir lynxtron-go build`

### Blockers

- 当前 blocker 已被收敛为单点：
  - `preload.ts` 尚未实现 Web showcase API
- 因此下一步应从 host bridge 开始，而不是重新打开 UI 入口

### Next Action

- 用一张新的实现任务补齐 host bridge：
  - `getTargets`
  - `isWebBuilt`
  - `needsWebSourceRun`
  - `runWeb`
  - `startWeb`
  - `devWeb`
- 之后再做 `showcases/cross-platform-notes` 的最小 smoke
