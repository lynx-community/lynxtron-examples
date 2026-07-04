# Status Log

## 2026-05-20

### Active Task

对 dead code cleanup 后的 preview 模式做 runtime smoke，并在通过后提交改动。

### Progress

- 已运行 `pnpm preview`，覆盖 pack showcases、本地 registry 发布、GO preview-mode build、GO runtime launch。
- 启动日志确认 `Baking 6 showcase(s), sourceMode=local-registry`。
- Lynx DevTool 连接到 preview GO runtime，确认首屏为 Gallery Home。
- DevTool DOM / screenshot 确认：
  - `PREVIEW` badge 可见
  - `6 showcases ready` 可见
  - gallery 中 benchmark / counter / cross-platform-notes / native-texture-canvas / pc-mouse-cursor 等卡片渲染
  - card 上 `LOCAL` 标记可见，符合本地 registry preview 语义
- DevTool console error/warning 列表为空。
- smoke 后已停止 `pnpm preview`、Lynxtron runtime 与 Verdaccio 进程。

### Verification

- `pnpm preview`
  - passed through runtime launch
- Lynx DevTool DOM inspection
  - passed
- Lynx DevTool screenshot
  - passed
- Lynx DevTool console check
  - passed；no error/warning entries

### Blockers

- 当前无 blocker。

### Next Action

- 提交 dead code cleanup 与 PM workflow/status 记录。

## 2026-05-18

### Active Task

PM 模式推进仓库 dead code 清理，覆盖 Lynxtron GO、showcases、packages 与 repo scripts。

### Progress

- 已读取 `project-pm-driver` skill、PM 文档集说明、workflow 模板与 review/status 模板。
- 已复核现有 `docs/project-goal.md`、`docs/product-plan.md`、`docs/workflow.md` 和当前仓库 workspace 结构。
- 已确认本轮清理是 source maintenance，不改变 showcase artifact、preview distribution 或 runtime path。
- 已新增专项 workflow：`docs/workflows/2026-05-18-chore-dead-code-cleanup.md`。
- 已把 dead code 清理的验收口径写入 `docs/product-plan.md` 与 `docs/workflow.md`。
- 已派发三个 disjoint worker：
  - Worker A / Pasteur：`lynxtron-go/src/app/**` 与必要的 `lynxtron-go/src/shared/**`
  - Worker B / Kuhn：`lynxtron-go/src/main/desktop/**`、`src/extension-host/**`、`scintilla-extension/**`、GO scripts
  - Worker C / Laplace：`showcases/**`、`packages/**`、repo `scripts/**`
- 已验收 Worker A：
  - 删除 GO app 层未读状态、未引用 capture 回调、未引用 statusbar registry API，以及无导入方的 `shared/ide-mode.ts`。
- 已验收 Worker B：
  - 删除未引用 `afterPack.js` / `pty_wrapper.c`。
  - 删除 Scintilla extension 中未使用的 `callByLynxJS` 测试 binding、`PositionFromLine` wrapper、`GetCocoaView` accessor。
  - 清理 `prepare-runtime-deps.js` 中未读局部变量，同时保留 package copy side effect。
- 已验收 Worker C：
  - 将 CLI 内部类型从 exported 改为 module-private，删除未 emit 的 `install-error` NDJSON variant。
  - 删除 showcase bootstrap 函数和 standalone web server 的未引用 exports。
  - 删除 shell 脚本未使用的 `warn()` helper 与 `YELLOW` color 常量。

### Verification

- `git diff --check`
  - passed
- `pnpm --dir lynxtron-go exec vitest run`
  - passed；15 test files / 164 tests
- `pnpm --dir lynxtron-go build`
  - passed；仅剩已有 Lynx CSS `lines` warning 与 preload dynamic require warning
- `pnpm --dir packages/cli test`
  - passed；3 test files / 10 tests
- `pnpm --filter @lynxtron-showcases/cli build`
  - passed
- `pnpm --dir showcases/cross-platform-notes build`
  - passed
- `pnpm --dir showcases/cross-platform-notes build:web`
  - passed
- `pnpm --dir showcases/pc-mouse-cursor build`
  - passed
- `pnpm --dir showcases/pc-mouse-cursor build:web`
  - passed
- `pnpm preview:build`
  - passed；packed showcase distribution + local registry + GO preview-mode build 路径通过
- `pnpm run generate-registry`
  - not run；未改 registry inputs 或 showcase metadata

### Blockers

- 当前无验收 blocker。

### Next Action

- 可按 commit discipline 拆提交：先提交 PM docs/workflow，再提交 dead code cleanup 实现。
- Follow-up：`preview:build` 启动的 Verdaccio 在 `local-registry.sh stop` 后仍短暂可见，本次已手动清理进程；可后续单独加固 stop 逻辑。

## 2026-05-09 17:58 CST

### Active Task

收口 `native-texture-canvas` Native Texture Canvas 画板从 NSView 集成切换到 shared-buffer texture 集成。

### Progress

- 已将 `native-texture-canvas` 改为 `IsSurfaceEnabled()` + `AcquireSurface()` / `SwapBack()` 路径。
- macOS 端直接写入 Lynxtron 提供的 `IOSurfaceRef` shared buffer，不再创建 Cocoa `NSView`。
- 绘制调度改为 `VSyncObserver::RequestAnimationFrame` 驱动，move 事件只合并增量状态。
- 画板状态改为 CPU-side incremental pixel buffer；每次拖动只合成新增 segment，避免历史 stroke 全量重放导致越画越卡。
- 已修正 IOSurface / Lynx 坐标系 y 轴方向，以及透明度在密集采样下被反复叠加的问题。

### Verification

- `git diff --check`
  - passed
- `pnpm --dir showcases/native-texture-canvas run build:native-texture`
  - passed
- `pnpm --dir showcases/native-texture-canvas run build`
  - passed
- Runtime smoke
  - passed；用户验收 canvas 展示、y 轴、拖拽流畅度和透明度交互正常。

### Acceptance

- Status: accepted
- 当前实现是 shared-buffer texture 集成，不再是 NSView 集成。

## 2026-05-09 17:20 CST

### Active Task

PM review `native-texture-canvas` 转为 Native Texture Canvas 画板 case 的当前改动质量。

### Progress

- 已确认改动范围集中在 `showcases/native-texture-canvas/`、`showcase-registry.json`、`pnpm-lock.yaml` 和 `docs/product-plan.md`。
- 已确认产品计划已从旧的 System Info / File Preview Native Texture Canvas 更新为 Native Texture Canvas 画板叙事。
- 已确认 packaged artifact dry-run 只包含 `dist/desktop/**/*` 和 `thumbnail.svg`，不再把 source extension、旧 sample assets 或构建缓存打进 tarball。
- 已确认 native extension 构建依赖被记录到 `showcases/native-texture-canvas/package.json` / `pnpm-lock.yaml`，不只依赖 Scintilla extension 的本地 `node_modules`。

### Verification Reviewed

- `pnpm --dir showcases/native-texture-canvas run build`
  - passed；native extension 编译、Rspeedy build、Rspack build 均通过
- `npm --cache /private/tmp/npm-cache-codex pack --dry-run`
  - passed；tarball contents 符合 dist distribution model
- `pnpm run generate-registry`
  - passed；`showcase-registry.json` 已同步新 description / tags
- `git diff --check`
  - passed
- User runtime smoke
  - passed；native-texture-canvas 画板 smoke 验收正常

### Acceptance

- Status: accepted
- 用户已完成 runtime smoke 验收，native-texture-canvas 画板可作为 Native Texture Canvas showcase 收口提交。
- 当前实现使用 Cocoa `NSView` native canvas，并且 `IsSurfaceEnabled()` 返回 `false`；产品上接受其表达 “native canvas 集成 UI / native texture hybrid” 的展示目标。

### Risks / Blockers

- Preview packed artifact fetch/run 后加载 `lynxtron-native-texture-canvas` 的 `.node` 仍可作为后续 preview 全链路回归项。
- PM operating model 本轮没有通过 subagent 实现；这是流程偏差，已在提交记录前明确记录。

### Next Action

- 提交 Native Texture Canvas showcase 改动。

## 2026-05-09

### Active Task

PM 模式验收并收口 `cross-platform-notes` demo 完整实现。

### Progress

- 已通过 worker 完成 showcase 本体实现，写入范围限定在 `showcases/cross-platform-notes/`。
- 已补齐：
  - standalone web 自包含 server，移除对未声明 `npx serve` 的依赖
  - shared app TypeScript diagnostics
  - title/content dirty state
  - 约 500ms autosave debounce
  - 切换 / 新建前 dirty note flush
  - root README
  - desktop runtime 双栏布局修正
- Web 布局错乱已通过升级 Lynx Web 相关工具链修复，并移除了临时 CSS 注入 workaround。
- 共性 Lynx / Lynxtron / Rspack / TypeScript 依赖版本已集中到 `pnpm-workspace.yaml` catalog。
- 已发现本地 `node_modules` runtime stale，并运行 `pnpm install --frozen-lockfile` 对齐 lockfile：
  - `@lynx-js/lynxtron@4.0.0-alpha.2-oss`
- 已运行 `pnpm ignored-builds`，结果为 None。

### Verification

- `pnpm --dir showcases/cross-platform-notes exec tsc --noEmit -p src/app/tsconfig.json`
- `pnpm --dir showcases/cross-platform-notes run build`
- `pnpm --dir showcases/cross-platform-notes run build:web`
- `pnpm --dir showcases/cross-platform-notes run start:web`
- `curl -I` verified `/`, `/main.web.bundle`, and `/__lynx_web__/static/js/index.js` with COOP / COEP headers
- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts src/main/desktop/showcase-install.test.ts`
  - 25 tests passed
- `pnpm --dir lynxtron-go build`
  - passed；仅剩已有 `preload-lynxtron-runtime.ts` dynamic require warning
- Standalone desktop runtime smoke:
  - `pnpm --dir showcases/cross-platform-notes run start`
  - Lynx DevTool confirmed rendered `notes-root`, note list, editor inputs, platform footer
  - screenshot confirmed two-column note list + editor layout
  - page console error/warning list empty
- Standalone browser visual smoke:
  - `pnpm --dir showcases/cross-platform-notes run start:web`
  - DevTools confirmed expected computed flex directions
  - screenshot confirmed two-column Web layout
- `pnpm --filter benchmark run build`
  - passed; old `@lynx-js/react/hooks` exports mismatch no longer reproduces
- `pnpm preview:build`
  - passed

### Blockers

- 当前无 showcase 本体 blocker。
- GO 内 `Run on Web / Debug on Web` 点击链路仍未做真实 runtime smoke；这属于 GO Web action integration 验证项。

### Next Action

- 如要完成端到端展示验收，下一步单独跑 GO `Run on Web / Debug on Web` runtime smoke。

## 2026-05-09

### Active Task

PM 模式规划 Lynxtron GO IDE 路由前进 / 回退按键。

### Progress

- 已确认该需求承接现有 `Navigation / Route Foundation`，不是新的完整 router。
- 已冻结本轮 MVP：
  - IDE workspace 中提供可见 Back / Forward 路由按钮。
  - Back 从 workspace 回到 gallery home。
  - Back 后清空 active `workspaceSession`，避免 Run / Debug 误作用于隐藏 workspace。
  - Forward 可恢复刚才 workspace 的 session / active file。
  - 不做文件历史、tab 历史、cursor 历史，不改变 Run 语义。
- 已更新 `docs/product-plan.md`，新增 `5.2.1 IDE 路由前进 / 回退按键`。
- 已新增实现 handoff：
  - `docs/workflows/2026-05-09-feat-go-route-navigation-buttons.md`
- worker 已按 handoff 实现：
  - 新增 one-slot route navigation state：当前 route + 可恢复的 `forwardWorkspace` snapshot。
  - IDE workspace 中显示 Back / Forward 控件；初始 Home 不显示控件，Back 后 Home 显示可用 Forward。
  - Back 会清空 active `workspaceSession` / ref，避免 Run / Debug 对隐藏 workspace 生效。
  - Forward 会恢复保存的 `WorkspaceSession` 和 route，并消费 forward target。
  - 打开新 workspace / deep link home 会清空 forward target。
- PM review 要求补了一次 polish：初始 Gallery Home 不显示全 disabled 的路由控件。
- 用户 preview 验收发现 Back 回到 Gallery 后，原生 Scintilla 编辑区仍悬浮覆盖在 Gallery 上。
- 已定位并修复原生编辑区残留：
  - `scintilla-view` 会手动挂到 `NSWindow.contentView`，原先析构只 release，没有 `removeFromSuperview`，父视图会继续持有它。
  - 新增 Scintilla extension `detachFromWindow(editorId)`，并在 Home 路由 / 无活动 tab 时主动 detach。
  - 原生 `ScintillaView` 析构时也会先 detach，再 release，避免组件卸载后残留 native view。
- 用户继续 preview 验收发现从第二个 editor 回退第一个 editor 时崩溃。
- 已补 native registry 生命周期修复：
  - `Unregister(editorId)` 改为 `Unregister(editorId, view)`，只有当前注册指针与析构 view 一致时才删除 registry 项。
  - 避免同一个 `main-editor` id 下，旧 editor 析构误删新 editor 的 registry 映射。
  - `detachFromWindow(editorId)` 不再持 registry 锁同步切主线程，降低 route/unmount 交错时的生命周期风险。

### Verification

- PM 文档阶段仅做需求收口与代码/文档现状复核；无 runtime 验证是有意为之。
- 实现阶段：
  - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts src/app/shared/navigation.test.ts`
    - 9 tests passed
  - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts src/app/shared/navigation.test.ts src/app/commands/showcase-commands.test.ts src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`
    - 19 tests passed
  - `pnpm --dir lynxtron-go build`
    - passed；仅剩已有 `preload-lynxtron-runtime.ts` dynamic require warning
  - 用户 preview 验收反馈修复后：
    - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts src/app/shared/navigation.test.ts src/app/commands/showcase-commands.test.ts src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`
      - 19 tests passed
    - `pnpm --dir lynxtron-go build`
      - passed；Scintilla native extension 重新编译成功，仅剩已有 dynamic require warning
  - 第二 editor 回退崩溃修复后：
    - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts src/app/shared/navigation.test.ts src/app/commands/showcase-commands.test.ts src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`
      - 19 tests passed
    - `pnpm --dir lynxtron-go build`
      - passed；Scintilla native extension 重新编译成功，仅剩已有 dynamic require warning
- Runtime partial smoke：
  - 使用 npm package runtime 启动 `lynxtron-go/dist/desktop`，DevTool 连接成功。
  - 初始 Gallery Home DOM 中未出现 `RouteNavigationControls`，符合“初始 home 不显示 disabled 控件”要求。
  - 通过 `__ide_debugOpenExampleArtifactRoute("view")` 进入 example workspace，DOM / screenshot 确认 IDE workspace 打开，右上角出现路由控件，Back enabled / Forward disabled。

### Blockers

- DevTool `Input_emulateTouchFromMouseEvent` 未能触发 route 按钮 `bindtap`，因此 Back / Forward 点击链路还没有完成自动化 runtime smoke。
- 使用本地 Debug runtime 第一次启动 GO 时出现 native SEGV；随后用 npm package runtime 可正常启动并完成 partial smoke。该 Debug runtime crash 先记录为环境 / runtime 问题，不作为本功能代码回归结论。

### Next Action

- preview 已重启，等待手动确认：workspace 点击 Back 回到 Gallery 时不再残留编辑区，Home 点击 Forward 恢复 workspace，Home 状态下 Run / Debug 不作用于隐藏 workspace。

## 2026-05-09

### Active Task

PM 模式评估 `cross-platform-notes` demo 当前状态。

### Progress

- 已确认 `cross-platform-notes` 是完整 showcase artifact，不是 example artifact。
- 已确认当前 distribution 同时存在：
  - 源码 showcase：`showcases/cross-platform-notes`
  - built desktop/web dist：`dist/desktop`、`dist/web`
  - packed tarball：`cross-platform-notes-0.0.1.tgz`
- 已确认 runtime 路径：
  - standalone desktop：`lynxtron ./dist/desktop`
  - standalone source web：`npm run start:web`
  - GO built web：`showcase-web-server.js` serve `dist/web`
  - GO source web：`npm run start:web` / `npm run dev:web`
- 已更新 `docs/lynxtron-go-showcase-web-status.md`，记录当前代码已经包含 Web host bridge 和 UI 入口，旧的 2026-04-17 状态已过期。

### Verification

- `pnpm --dir showcases/cross-platform-notes run build`
- `pnpm --dir showcases/cross-platform-notes run build:web`
- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts src/main/desktop/showcase-install.test.ts`
- `pnpm --dir lynxtron-go build`
- `node lynxtron-go/dist/desktop/showcase-web-server.js showcases/cross-platform-notes/dist/web`
- `curl -I` verified `/`, `/main.web.bundle`, and `/__lynx_web__/static/js/index.js`

### Blockers

- `pnpm --dir showcases/cross-platform-notes exec tsc --noEmit -p src/app/tsconfig.json` fails on `<input value=...>` typing.
- `serve` is not installed, so `start:web` is not self-contained despite using `npx serve`.
- Runtime UI smoke is still missing for standalone desktop, standalone browser, and GO `Run on Web / Debug on Web`.

### Next Action

- Fix source web self-containment and shared UI typing before marking the demo fully ready.

## 2026-05-08

### Active Task

PM 模式梳理 Lynxtron GO “文件内搜索”需求。

### Progress

- 已按 `project-pm-driver` 进入 PM 工作模式；本轮不直接实现产品代码。
- 已复核当前产品文档与 workflow，确认 GO 的定位仍是 showcase gallery + runner + 轻量 workspace shell，不是完整 IDE 产品化。
- 已复核当前搜索相关实现：
  - `SearchPanel` 现有能力是 workspace 级 `Search in files...`。
  - host bridge 现有 `search.findInFiles(rootPath, query)`，会扫描 workspace 文件并返回结果。
  - menu / event 现有入口是 `ide:findInFiles`，切到 sidebar search panel。
  - 当前未看到活动文件内搜索条、当前文件 match 导航、Cmd+F 语义或替换能力。
- 已冻结本轮 MVP：
  - `Cmd+F` / `Ctrl+F` 打开当前文件查找条。
  - Enter / Shift+Enter 导航上一个或下一个匹配。
  - 当前匹配通过 editor selection 或等价方式高亮并滚动到可见位置。
  - 本轮不做替换、正则、大小写开关、整词匹配。
- 用户补充约束：UI 尽量在前端实现。
  - 已更新 handoff，要求查找条 UI 与交互状态由 Lynx 前端承载。
  - host/native 只负责 `Cmd+F` 菜单事件和复用现有 editor selection/navigation。
  - 不新增原生 UI，也不优先新增 Scintilla native API。
- 已更新产品计划：
  - `docs/product-plan.md` 新增 `5.4 当前文件内搜索`。
- 已新增实现 handoff：
  - `docs/workflows/2026-05-08-feat-current-file-search.md`。
- worker 已按 handoff 实现当前文件搜索：
  - `CmdOrCtrl+F` 菜单事件映射到 `ide:findInFile`。
  - 查找条 UI 为 Lynx 前端组件 `CurrentFileFindBar`。
  - 匹配计算抽到 `current-file-search` helper，并覆盖大小写不敏感匹配与循环导航测试。
  - 查找导航复用现有 `openFileAt` / Scintilla selection + scroll 能力，未新增原生 UI 或 native extension API。
- 用户已完成运行态验收并确认通过。

### Verification

- PM 文档阶段：仅做需求澄清与代码/文档现状复核，未做 runtime 验证；无 runtime 验证是有意为之。
- 实现阶段：
  - `pnpm --dir lynxtron-go exec vitest run src/app/shared/current-file-search.test.ts src/app/commands/showcase-commands.test.ts`
    - 7 tests passed
  - `pnpm --dir lynxtron-go build`
    - passed；仅剩已有 dynamic require warning
  - 用户运行态验收：
    - passed

### Blockers

- 当前无 blocker。

### Next Action

- 提交当前文件搜索实现。

## 2026-05-08

### Active Task

修复 Lynxtron GO preview 模式下，showcase 在 IDE 中保存后 Run 触发 `npm install` 失败的问题。

### Progress

- 已确认 preview 的产品模型仍是模拟已发布 npm 包环境，保存后 source run 必须继续使用 `npm install`，不能回退到 pnpm workspace。
- 已定位根因：
  - `~/.lynxtron-go/.npmrc` 指向 local registry，但 npm 不会自动把该父级配置应用到 `~/.lynxtron-go/showcases/<name>`。
  - 第一轮注入 `NPM_CONFIG_USERCONFIG` 后，仍被父进程继承的 `npm_config_registry=https://bnpm.byted.org/` 覆盖。
- 已修复 install plan 与运行环境：
  - standalone showcase install plan 会记录最近的 preview workspace `.npmrc`。
  - 执行 `npm install` 时会清理继承来的 npm registry/userconfig 环境变量，再显式设置 `NPM_CONFIG_USERCONFIG`。
  - `npm install` 失败时会把 stdout/stderr 尾部写入错误与 debug log，避免只显示泛化的 `Command failed: npm install`。
- 已补回归测试覆盖 preview `.npmrc` 继承和 inherited registry env 覆盖问题。

### Verification

- `pnpm --dir lynxtron-go exec vitest run src/main/desktop/showcase-install.test.ts`
  - 23 tests passed
- `pnpm --dir lynxtron-go build`
  - passed；仅剩已有 dynamic require warning
- `pnpm test`
  - CLI 10 tests passed
  - Lynxtron GO 150 tests passed
- `LYNXTRON_SHOWCASE_SOURCE=local-registry pnpm --dir lynxtron-go build`
  - passed；已重新生成 local-registry preview dist 供本地重启 smoke

### Blockers

- 当前无代码侧 blocker。
- 运行中的 Lynxtron GO 进程不会热更新 preload，需要重启 GO 后才能验证新 install 环境。

### Next Action

- 重启 Lynxtron GO 后，在 preview local-registry 模式下重新执行：打开 showcase -> 修改并保存 -> Run。

### Follow-up: Run UI Responsiveness

- 已定位 Run/Debug source 模式在安装依赖时卡住 Terminal / Output 的根因：preload showcase service 使用同步 `execFileSync` 执行 `npm install`，而调用链由 Lynx UI 事件直接触发，导致安装完成前 UI JS 线程无法响应。
- 已将 source Run、source Debug、Web source Run/Debug、Install Dependencies 的依赖安装阶段改为异步 child process，并保留 stdout/stderr 尾部错误信息与 5 分钟超时。
- App 侧已改为等待异步 `start` / `dev` / `installDependencies` 结果后再写入 pid 与状态，安装过程中状态停留在 `Installing dependencies...`，避免错误显示成已经 launch。
- 已补充 GO 执行 showcase 子进程的 Output 日志流：
  - preload 会收集 `npm install`、`npm start`、`npm run dev`、Web start/dev、built run/web run 的 stdout/stderr。
  - App 每 200ms 读取一次并追加到 Output，日志带 `showcase.install` / `showcase.start` 等来源前缀。
  - source Run/Debug 的状态文案改为 command started / starting，避免在 showcase 窗口真正出现前显示 `Run launched`。
- 验证：
  - `pnpm --dir lynxtron-go exec vitest run src/main/desktop/showcase-install.test.ts src/app/commands/showcase-commands.test.ts`
    - 25 tests passed
  - `pnpm --dir lynxtron-go build`
    - passed；仅剩已有 dynamic require warning
  - `pnpm test`
    - CLI 10 tests passed
    - Lynxtron GO 150 tests passed
  - `LYNXTRON_SHOWCASE_SOURCE=local-registry pnpm --dir lynxtron-go build`
    - passed；仅剩已有 dynamic require warning

### Follow-up: Gallery Open Loading

- 已修复 Gallery 点击 showcase `Open` 时等待打开过程没有 loading 蒙层的回归。
- 已补回 showcase 专用 loading 状态，和 Example Artifact 共用 `LoadingOverlay` 展示层；本地 workspace 打开和远程/preview tarball fetch 都会显示 `Preparing workspace for <name>...`。
- 已将 preload `showcase.fetch` 从同步 CLI 调用改为异步 child process，避免 UI 线程被 fetch 阻塞导致 loading 状态无法绘制。
- `showcase.fetch` 的 CLI stdout/stderr 也会进入 Output 日志流，和 Run 日志行为一致。
- 验证：
  - `pnpm --dir lynxtron-go build`
    - passed；仅剩已有 dynamic require warning
  - `pnpm --dir lynxtron-go exec vitest run src/main/desktop/showcase-install.test.ts src/app/commands/showcase-commands.test.ts src/app/example-artifact.test.ts`
    - 40 tests passed
  - `LYNXTRON_SHOWCASE_SOURCE=local-registry pnpm --dir lynxtron-go build`
    - passed；仅剩已有 dynamic require warning
  - `pnpm test`
    - CLI 10 tests passed
    - Lynxtron GO 150 tests passed

## 2026-04-27

### Active Task

规划 `lynxtron://` 的文件导航扩展：让 `showcase/open` 和 `example/open` 在打开 workspace 后支持按 query 直接定位到指定文件和行号，并高亮目标行。

### Progress

- 已完成需求澄清并冻结本轮 MVP 范围：
  - 只支持 `showcase/open` 与 `example/open`
  - 明确不支持 `folder/open`
  - `file` 只接受 workspace 内相对路径
  - `line` / `column` 对外统一为 1-based
  - 高亮语义固定为整行高亮
- 已把该能力回收到当前产品定义中：
  - `docs/project-goal.md`
  - `docs/product-plan.md`
- 已新增独立 handoff，供后续实现派发：
  - `docs/workflows/2026-04-27-feat-go-scheme-file-navigation.md`
- 已冻结关键参数规则：
  - `column` 仅在 `line` 存在时合法
  - `line` / `column` 仅在 `file` 存在时合法
  - 路径归一化后若逃逸出 workspace root，按非法参数处理
  - 文件不存在时仍进入 workspace，但要给出明确错误
  - `line` / `column` 越界时钳制到最后可用位置

### Verification

- 本轮仅做 PM 文档收口与实现计划冻结，无 runtime 验证；无 runtime 验证是有意为之
- 复核依据：
  - `docs/project-goal.md`
  - `docs/product-plan.md`
  - `docs/workflow.md`
  - `docs/workflows/2026-04-10-feat-go-scheme-handler.md`
  - `lynxtron-go/src/shared/deep-link.ts`
  - `lynxtron-go/src/app/App.tsx`

### Blockers

- 当前无外部 blocker；下一步是实现切片与 focused verification，不是继续做需求澄清

### Next Action

- 按新 handoff 派发实现，优先收敛：
  - deep-link grammar / parser 扩展
  - app-side deep-link payload 到 editor 定位链路
  - focused tests 与本地 scheme smoke
- 实现完成后，再由 PM 按 packaged / local 边界决定是否需要额外 protocol 验收

## 2026-04-17

### Active Task

评估当前工程是否需要重新梳理架构并决定是否进入重构阶段。

### Progress

- 已复核现有产品定位、计划和 workflow，确认项目的大方向仍然是：
  - monorepo
  - `packages/cli` thin launcher
  - showcase 作为完整 Lynxtron app
  - Lynxtron GO 作为 gallery + runner + workspace shell
- 已复核代码现状，确认当前架构压力主要集中在 `lynxtron-go`，而不是整个仓库的 package 拆分失效
- 已确认两个主要热点：
  - `lynxtron-go/src/app/App.tsx` 持续承载 route、workspace、editor、diagnostics、showcase/example 打开链路与 deep-link 应用逻辑
  - `lynxtron-go/src/main/desktop/preload.ts` 同时承载 fs/config bridge、extension host、PTY、showcase/example runtime 管理
- 已将 PM 结论写入 `docs/product-plan.md`：
  - 不做仓库级大重构
  - 启动一轮 `lynxtron-go` 定向架构整治，并保持任务可拆分、可验收
- 已新增专用 workflow：
  - `docs/workflows/2026-04-17-chore-go-architecture-stabilization.md`
  - 将本轮整治拆为 workspace model、app-shell split、preload service split、deep-link/run 边界收敛、docs closeout 五步
- 已为 Step 1 补齐独立 handoff：
  - `docs/workflows/2026-04-17-chore-go-workspace-session-model.md`
  - 明确冻结的领域模型关系、owned files、verification 和 delivery note 格式
- 已按该 handoff 派发 Step 1 实现切片：
  - 只允许处理 app-side workspace session / route / run target 模型
  - 明确不触碰 `preload.ts`、`main.ts` 和 packaged deep-link 验收
- Step 1 第一轮实现已返回：
  - `WorkspaceSession` / `session -> route` / `session -> run target` 已落地
  - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts` 通过
  - `pnpm --dir lynxtron-go exec vitest run src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts` 通过
  - `pnpm --dir lynxtron-go exec vitest run src/app/example-artifact.test.ts` 通过
  - `pnpm --dir lynxtron-go build` 通过
- PM 独立复核后当前结论为：Step 1 仍是 `follow-up needed`
  - 原因：`WorkspaceSession.activeFile` 已进入新模型，但 `openFile / switchTab / closeTab` 路径尚未维护该字段，active-file ownership 仍未真正收敛到 session 模型
- Step 1 follow-up 已完成并通过 PM 独立复核：
  - `openFile / switchTab / closeTab` 现在会同步 `workspaceSession.activeFile`
  - route 继续从 session 派生，active-file ownership 已收回到 session 模型
  - PM 独立复跑：
    - `pnpm --dir lynxtron-go exec vitest run src/app/shared/workspace-session.test.ts`
    - `pnpm --dir lynxtron-go exec vitest run src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-runtime.test.ts`
    - `pnpm --dir lynxtron-go exec vitest run src/app/example-artifact.test.ts`
    - `pnpm --dir lynxtron-go build`
  - 结果：全部通过；build 仅剩已有的 2 条 dynamic `require` warning

### Verification

- 文档与代码阅读：
  - `docs/project-goal.md`
  - `docs/product-plan.md`
  - `docs/workflow.md`
  - `docs/status-log.md`
  - `docs/workflows/2026-04-03-feat-navigation-route-foundation.md`
  - `docs/workflows/2026-04-10-feat-go-scheme-handler.md`
  - `docs/workflows/2026-04-17-chore-go-architecture-stabilization.md`
  - `lynxtron-go/src/app/App.tsx`
  - `lynxtron-go/src/app/shared/navigation.ts`
  - `lynxtron-go/src/app/shared/ide-mode.ts`
  - `lynxtron-go/src/main/desktop/main.ts`
  - `lynxtron-go/src/main/desktop/preload.ts`
- 本次为 PM 评估与文档决策更新，无 runtime 验证；无 runtime 验证是有意为之

### Blockers

- 当前不是技术阻塞，而是决策与排期问题：
  - 如果继续优先叠加 GO 新能力而不先做定向整治，后续改动成本和验收成本会继续上升

### Next Action

- 将下一批 GO 相关工作改为“定向架构整治 + 能力不中断”的拆分任务
- 第一优先级建议放在：
  - app-shell / navigation / workspace model 收敛
  - preload service 拆分
  - host/app deep-link 与 run 语义边界收敛
- 下一步按新 workflow 的 Step 1 开始派发：先收敛 workspace session / route / run target 模型，再决定后续切片的文件拥有边界
- 当前 Step 1 已具备可派发条件
- Step 1 已 accepted
- 下一步进入 Step 2：app-shell / workspace orchestration 拆层，但要继续保持 Step 1 形成的 workspace session 作为唯一核心模型
- 已新增 Step 2 / Step 3 handoff：
  - `docs/workflows/2026-04-17-chore-go-app-shell-split.md`
  - `docs/workflows/2026-04-17-chore-go-preload-service-modularization.md`
- 已新增 Step 4 handoff：
  - `docs/workflows/2026-04-17-chore-go-deeplink-run-boundary.md`
- 当前计划改为并行推进：
  - Step 2 处理 app-side shell/orchestration 拆层
  - Step 3 处理 preload service 模块化

## 2026-04-14

### Active Task

收口 showcase TS diagnostics 假阳性修复，并完成 Lynxtron ICU runtime blocker 的真实运行态验收。

### Progress

- 已确认 desktop host runtime 崩溃的根因在 Lynxtron mac app bundle ICU 数据打包，而不在 `lynxtron-go` diagnostics 逻辑本身
- 已在 Lynxtron 仓库提交修复：
  - repo: `/Users/bytedance/ws2/lynxtron_oss_ws/lynxtron`
  - commit: `c20cf1b`
  - subject: `[Fix] Bundle full ICU data in mac app`
- 已用该提交产出的 `lynxtron.app` 覆盖本地 `node_modules/@lynx-js/lynxtron` 二进制
- 已在真实运行中的 `lynxtron-go/dist/desktop` preload bridge 中验证：
  - `showcases/counter/src/main/desktop/main.ts` 返回 `0 markers`
  - `showcases/counter/src/app/App.tsx` 返回 `0 markers`
- 用户已补完 GUI 手工 smoke，确认本地替换后的二进制链路可用

### Verification

- 本地 Lynxtron binary check：
  - `Contents/Resources/icudtl.dat` 为 `10M`
  - `Contents/Frameworks/Lynxtron Framework.framework/Resources/icudtl.dat` 为 `10M`
- 真实运行态 diagnostics：
  - `npx lynxtron ./dist/desktop`
  - 在运行中的 preload bridge 调用 `ls.updateFile()` / `ls.getDiagnostics()`
  - `/tmp/lynxtron_debug.log` 记录：
    - `Received diagnostics for .../showcases/counter/src/main/desktop/main.ts: 0 markers`
    - `Received diagnostics for .../showcases/counter/src/app/App.tsx: 0 markers`
- 运行过程中未出现新的 `ExtHost exited`

### Blockers

- 本任务主链路已无技术 blocker
- 当前剩余是发布/依赖滚动问题：
  - show-cases 侧目前仍依赖本地替换 `node_modules` 二进制完成验证
  - 后续需要将 Lynxtron commit `c20cf1b` 进入正式包版本，移除人工替换步骤

### Next Action

- 将 showcase diagnostics false-positive workflow 标记为 runtime smoke 通过
- 在合适时机升级 `@lynx-js/lynxtron` 到包含 `c20cf1b` 的正式版本
- 继续处理下一条产品主线，不再把 ICU 问题视为当前任务阻塞

## 2026-04-10

### Parallel Task: Showcase TS Diagnostics

- 已完成 showcase diagnostics 假阳性主修复：
  - 新增 app / web / desktop 三类共享 tsconfig 模板
  - 为现有 showcase slice 补齐显式 `tsconfig.json`
  - 修正 slice `extends` 相对路径错误
  - `TypeScriptLanguageService` 改为读取完整 tsconfig command line，并为 pnpm workspace 下的 Node host 自动补 `typeRoots`
- 已新增回归测试覆盖：
  - showcase app JSX runtime 误报
  - showcase desktop host `path` / `__dirname` 误报
  - showcase web ambient `.d.ts` 误报
- 已完成 scoped 验证：
  - `pnpm --dir lynxtron-go exec vitest run src/extension-host/__tests__/typescript.test.ts src/extension-host/__tests__/css.test.ts src/app/diagnostics.test.ts`
  - `pnpm --dir showcases/counter build`
  - `pnpm --dir showcases/cross-platform-notes build`
- IDE 内真实编辑态 smoke 已继续推进：
  - editor `setText` blocker 已消失，example workspace 默认文件可正常打开
  - `showcases/counter/src/app/App.tsx` 在真实 runtime 中已验证为 `0 markers`
- 当前新的 runtime blocker：
  - 打开 `showcases/counter/src/main/desktop/main.ts` 时，extension host 因 `String.localeCompare(..., { numeric: true })` 抛出 `RangeError: Internal error. Icu error`
  - 崩溃点位于 `lynxtron-go/src/extension-host/language-server/typescript.ts` 的 pnpm `@types/node` 目录排序逻辑
  - 按“工程已支持 ICU”前提于 2026-04-10 再次复测后，问题仍然稳定复现
  - 在该问题修复前，desktop host slice 还不能记为 runtime smoke 通过

### Active Task

规划 Lynxtron GO 的 `lynxtron://` scheme handler，定义最小产品范围、宿主接入边界和验收方式。

### Progress

- 已完成 PM 侧上下文回收，确认该需求承接于既有 route foundation 之后，而不是独立的临时 debug 能力
- 用户已确认首版产品默认值：
  - scheme 正式名统一为 `lynxtron://`
  - 已运行时复用当前主窗口
  - 首版只打开目标 workspace / home，不自动 Run
- 已确认当前代码现状：
  - App 侧已经具备 `route`、`ideMode`、`example.open`、`showcase.open` 等稳定打开链路
  - 主进程还没有任何 `open-url` / scheme 分发逻辑
- 已检查本地 `@lynx-js/lynxtron@0.0.1-alpha.14` 类型定义，确认运行时 API 包含：
  - `app.on('open-url')`
  - `app.requestSingleInstanceLock()`
  - `app.on('second-instance')`
  - `app.setAsDefaultProtocolClient()`
- 已检查 `lynxtron-go/electron-builder.yml`，确认当前打包配置已经带有一个 macOS URL scheme 占位项 `LynxtronIDEMVP`，但尚未接入正式产品命名和主进程处理链路
- 已把首版产品范围冻结为：
  - `lynxtron://home`
  - `lynxtron://showcase/open?id=<showcase-id>`
  - `lynxtron://example/open?path=<example-relative-path>`
- 已明确第一版不做自动 Run，不暴露 folder / bundle debug scheme
- 已新增专用 workflow 文档用于后续派发实现
- 子代理已完成 MVP 代码落地：
  - 新增共享 deep-link parser / intent 模型
  - 主进程接入 `open-url`、`requestSingleInstanceLock()`、`second-instance`
  - 冷启动 pending intent + warm event notify 已打通
  - UI 侧复用了既有 showcase / example 打开链路
  - `electron-builder.yml` 已切换到公开 scheme `lynxtron-go`，并保留 `LynxtronIDEMVP` 兼容别名
- PM code review 已完成，当前结论为：实现通过代码审查，但 packaged smoke 未完成，任务状态维持 follow-up-needed
- 用户已临时调整优先级，先不处理 packaged follow-up，改为优先验证 un-packaged 本地运行时的 URL 行为
- PM 已独立完成本地 runtime smoke：
  - 冷启动命令行 `lynxtron ... lynxtron://showcase/open?id=benchmark` 时，主进程明确打印 `queued deep link intent`
  - 真正的 scheme 调起 `open location "lynxtron://showcase/open?id=counter"` 后，UI 仍停留在 Gallery Home
  - 热启动复用场景下，第二次触发后 UI 也没有进入目标 showcase workspace
- PM 已把故障边界收敛为：
  - host parser / queue 基本正常
  - `-lynx-invoke` 中 `consumePendingDeepLink` handler 名称匹配正常
  - 当前更像是 UI 首次 `consumePendingDeepLink('startup')` 没有稳定完成，导致 `mainWindowUiReady` 没被置为 true，后续 `ide:deepLinkPending` 事件链也随之失效

### Verification

- 文档与代码审查：
  - `docs/product-plan.md`
  - `lynxtron-go/src/main/desktop/main.ts`
  - `lynxtron-go/src/app/App.tsx`
  - `lynxtron-go/src/app/shared/navigation.ts`
  - `lynxtron-go/src/app/shared/ide-mode.ts`
  - `lynxtron-go/electron-builder.yml`
  - `lynxtron-go/node_modules/@lynx-js/lynxtron/apis/api/app.d.ts`
- 本轮为 PM 规划与文档冻结，尚未开始 runtime 验证；无 runtime 验证是有意为之
- 子代理验证结果：
  - `pnpm --dir lynxtron-go exec vitest run src/shared/deep-link.test.ts src/app/shared/deep-link-dispatch.test.ts` 通过，12/12
  - `pnpm --dir lynxtron-go build` 通过
  - `pnpm --dir lynxtron-go run pack` 失败，未能进入 packaged deep-link smoke
- PM 复核结果：
  - 已独立复跑 `pnpm --dir lynxtron-go exec vitest run src/shared/deep-link.test.ts src/app/shared/deep-link-dispatch.test.ts`，通过
  - 已独立复跑 `pnpm --dir lynxtron-go build`，通过
  - 已独立复现 `pnpm --dir lynxtron-go run pack` 失败，错误与子代理报告一致
- 本地 runtime smoke：
  - `pnpm --dir lynxtron-go build`，通过
  - `/Users/bytedance/ws2/lynxtron_oss_ws/out/Release/lynxtron.app/Contents/MacOS/lynxtron /Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go/dist/desktop lynxtron://showcase/open?id=benchmark`
  - `osascript -e 'open location "lynxtron://showcase/open?id=counter"'`
  - 使用 Lynx DevTool MCP 复查 UI DOM，确认页面仍停留在 Gallery Home，未进入目标 workspace

### Blockers

- 还未做 packaged-app 级别的 deep link smoke，因此不能宣称功能已进入实现或验收阶段
- 现有打包配置中的 scheme 名称 `LynxtronIDEMVP` 与计划中的正式产品命名 `lynxtron-go` 不一致，后续实现时需要统一并验证兼容策略
- packaged build 当前被 `electron-builder` 依赖树收集问题阻塞：
  - `dependency path is undefined packageName=node-fetch`
  - `unable to parse 'path' during 'tree.dependencies' reduce`
- 在该阻塞解除前，无法验证：
  - protocol registration 是否真正进入产物 `.app`
  - 冷启动 deep link smoke
  - 热启动 deep link smoke
- 即使暂时不看 packaged 产物，本地运行态也仍有前置功能缺口：
  - deep link 在主进程已入队，但 UI 未稳定消费 pending payload
  - 在这个问题修复前，不能把本地 runtime 记为功能通过

### Next Action

- 按已确认的产品默认值派发子代理实现 host parser、single-instance 接线、UI bridge 与 packaged smoke
- PM 在子代理回报后按 workflow 审查验证证据，并决定接受、打回或拆 follow-up
- 将当前 feature 记为 follow-up-needed，而不是 fully accepted
- 新开一个 scoped packaging follow-up，优先解决 `lynxtron-go run pack` 的 `node-fetch` dependency graph 问题
- 派发一个新的 scoped implementation slice，只修本地运行态的 `consumePendingDeepLink` 启动握手与热启动通知可靠性
- PM 在子代理交付后优先复测：
  - 本地冷启动 argv deep link
  - 已运行时真实 scheme 调起 `open location ...`
  - 页面是否真正切到 showcase / example workspace
- 本地运行态修复通过后，再决定是否回到 packaged follow-up

### Follow-up

- 已确认该阻塞值得拆成独立 packaging 任务，而不是继续混在 scheme handler 主任务里
- 当前已知上下文：
  - `lynxtron-go/dist/desktop/package.json` 仍直接带有 `node-fetch` 依赖
  - `lynxtron-go/src/main/desktop/example-artifact.ts` 运行时动态 `import('node-fetch')`
  - `lynxtron-go/node_modules/node-fetch` 是 pnpm symlink
  - `pnpm --dir lynxtron-go run pack` 在 electron-builder 收集依赖树阶段失败，尚未进入 deep-link smoke
- 下一条实施主线切换为：先恢复 `lynxtron-go` 的 packaged build，再回到 `lynxtron://` 的冷/热启动验收
- packaging follow-up 的第一轮实现已产出有效进展：
  - `node-fetch` 依赖树失败已被消除
  - `pack` 现在可以继续走到 runtime template 处理阶段
- PM 进一步确认了更深一层根因：
  - `@lynx-js/lynxtron-builder` 包内确实自带 `app-builder-lib+26.0.12.patch`
  - 该 patch 明确删除了 mac Helper rename 逻辑
  - 但当前 live `app-builder-lib/out/electron/electronMac.js` 仍是未打补丁版本
  - `patch.js` / `patch-package` 在当前 pnpm 布局下无法定位真实的 `app-builder-lib` 安装位置，因此 builder patch 没有实际生效
- 当前结论更新为：
  - 现阶段更像是 builder patch 应用链路失效，而不是 Lynxtron runtime 模板本身缺少必须由应用仓库补齐的文件
  - 下一轮实现应优先修复“repo-owned 的 patch apply 机制”，再重新验证 `pack`

## 2026-04-02

### Active Task

以 PM 模式收口当前阶段，并把项目文档统一到 `docs/` 管理；同时插入新的 Example Artifact URL 打开需求。

### Progress

- `alpha.14` 已作为当前 runtime 验收基线
- `lynxtron-go`、`benchmark`、`native-texture-canvas`、`cross-platform-notes` desktop runtime 已完成验证
- `preview:build` 已修通，`pnpm preview` 也已通过最小 smoke
- Node `>= 22` 与 pnpm build script 要求已写入文档
- `product-plan` 与关键 workflow 状态已更新
- `lynxtron-go` 的 IDE plan 已迁移到 `docs/lynxtron-go-ide-plan.md`
- `cross-platform-notes` 已接入 showcase registry / gallery
- 新增需求：让 Lynxtron GO 通过扩展命令打开符合 example artifact 协议的远程 Lynx UI example
- Example Artifact 第一版主链路已落地：相对路径输入、固定 base URL、临时缓存目录、展示全部 files、Run 时用 LynxWindow 加载 Lynx bundle
- 使用真实 example 相对路径 `view` 已验证通过，Lynxtron GO 会切换到临时 workspace，并打开缓存工程中的默认文件
- 为 Example Artifact 增加了本地 deterministic smoke 环境，支持不依赖公网的 `fetch -> cache -> workspace -> launcher` 回归验证
- 为 Example Artifact 增加了受控 direct-route debug entry，支持不依赖键盘注入直接进入目标 route，便于后续 scheme 和 UI 自动化
- 通过对 Lynxtron runtime 源码的检查确认：preload/BTS 的 Node embed 已移除 `kNoBrowserGlobals`，当前剩余问题主要转为交互反馈而非功能阻塞

### Verification

- 使用 Lynx DevTool MCP 验证了多个 desktop app 的实际运行态
- 使用 `pnpm preview:build` 验证 preview 工具链恢复
- 使用安装链路排查确认二进制缺失问题来自 pnpm build script 审批，而非下载地址或 install.js
- 使用真实 Example Artifact 路径 `view` 验证了 `Open Example Artifact -> 临时 workspace 打开 -> 默认文件打开 -> terminal cwd 切换`
- 使用 `pnpm --dir lynxtron-go test src/app/example-artifact.test.ts` 建立了本地 deterministic smoke 基线
- 使用 DevTool 直接触发 `__ide_debugOpenExampleArtifactRoute('view')` 验证受控 direct-route debug entry 可以稳定进入 example workspace

### Blockers

- runtime 仍有非致命 warning，需作为后续框架健康性问题跟踪
- `cross-platform-notes` 仍缺 side-by-side screenshot comparison，属于验证完善项而非当前阻塞
- Example Artifact 当前阻塞已降为 UX 问题：命令提交到打开 workspace 之间存在可感知延迟，缺少一个可复用、主区域级别的 loading overlay，容易让用户误判为无响应
- Route foundation Step 3 已完成并接受，但后续 scheme handler 仍未实现

### Next Action

- 为 Lynxtron GO 实现一个共享 loading overlay 组件，并先接入 Example Artifact，再用 Lynx DevTool 做真实 UI 验收
- 决定下一阶段是优先做展示层 polish，还是推进 Native Texture Canvas phase 2
- 如需要，再补一轮 screenshot comparison 作为 Phase 2 的附加验证
- 继续推进 route foundation 的后续步骤，优先评估 scheme handler 的最小接入方式

## 2026-04-03

### Active Task

收口 Example Artifact 的共享 loading overlay，并把 Lynx UI 实现的参考基线补进 workflow。

### Progress

- 已确认共享 `LoadingOverlay` 是正确产品方向，并已完成实现
- 已将 `https://lynxjs.org/llms.txt` 记入通用 workflow 和当前 feature workflow，作为 Lynx UI 任务的直接参考要求
- 已修正 preload 环境认知：当前工程默认把 `preload.ts` 视为标准 Node.js 环境加 Lynxtron 接口，`TextEncoder` / `TextDecoder` / `URL` 等标准能力不再默认记为框架缺失
- 已增加一个 debug-only 的 `Run Bundle URL` 调试链路，用于直接运行远程 `*.lynx.bundle` URL

### Verification

- 共享 `LoadingOverlay` 已通过 Lynx DevTool 结构验证
- 用户已完成人工 UI 验收，确认 loading 体验通过
- `Run Bundle URL` 已通过 scoped build 验证，并用真实 URL `http://10.69.205.46:3000/desktop_showcase.lynx.bundle` 完成行为型 smoke

### Blockers

- Example Artifact 若再次出现 metadata 下载异常，需优先核对当前 `dist/desktop` 与本地 Release runtime 是否一致，再决定是否记录为框架问题
- Route foundation 当前阶段已完成；剩余项不再是基础层阻塞，而是下一阶段的 scheme handler 与自动化接线

### Next Action

- 将 Example Artifact 与 shared loading overlay 的最终验收状态同步回产品计划和后续任务
- 继续下一阶段产品工作
- 以当前 route foundation 为基础推进 `lynxtron://` scheme 映射与自动化入口接入
- 视需要决定是否将 `Run Bundle URL` 进一步收敛进 scheme / route 体系，当前先保持 debug-only
- 新开一个博客截图用的 PC Mouse / Cursor showcase，突出 Lynx 的 hover 与 cursor 能力

## 2026-04-09

### Active Task

实现 Lynxtron GO 的 debug-only 本地 bundle 直开能力，让用户可以选取本地 `*.lynx.bundle` 并在独立 `LynxWindow` 中运行。

### Progress

- 已新增 `Run Bundle File` 命令入口，命令面板可触发本地文件选择
- 已在 host bridge 中增加 `openBundleFile`，选中文件后通过 `LynxWindow.loadFile(...)` 打开
- 已补充 `__ide_debugRunBundleFile(path)` 调试 hook，便于后续自动化 smoke
- 已增加命令注册单测，覆盖 `bundle.runFile -> startBundleFileRun` 的接线
- `lynxtron-go` scoped build 已通过
- `lynxtron-go` focused test 已通过

### Verification

- `pnpm --dir lynxtron-go test -- src/app/commands/showcase-commands.test.ts`
- `pnpm --dir lynxtron-go build`

### Blockers

- 真实 Lynxtron GO 运行态 smoke 被当前本地 runtime 启动问题阻塞，`npx lynxtron ./dist/desktop` 仍报 `Cannot find module '@lynx-js/lynxtron'`，与本次 bundle runner 逻辑无直接关系

### Next Action

- 先保留该功能的代码落地和文档记录
- 等 runtime 启动链路恢复后，再用 `__ide_debugRunBundleFile(path)` 或命令入口做一次真实 smoke

### Follow-up

- 已直接落地 `showcases/pc-mouse-cursor` 的最小单屏 showcase
- 当前设计已收敛为一个居中的海报式单屏交互方块，突出：
  - `cursor: crosshair`
  - hover 进入/离开状态
  - 鼠标位置实时跟随
- 已去掉实时变化的坐标主文案，并补入轻量 SVG 视觉锚点，整体视觉更接近 `hello-world` 的单屏海报式构图
- 真实运行态验证结果：
  - `bindmouseover` / `bindmousemove` 均可触发
  - 按 Lynx `MouseEvent` 文档改为优先读取事件顶层 `x / y / pageX / pageY / clientX / clientY` 后，位置跟随已成立
  - 用户已人工确认“跟随效果正常”
- 当前阶段仅收口了 showcase 本体与交互能力，尚未进入 registry / gallery 集成
- 用户已追加新的视觉方向要求：
  - 去掉实时变化的坐标主文案
  - 继续保持单 block、简单、直观
  - 视觉上参考 `lynx-examples/hello-world` 的海报式单屏构图和资产使用方式
  - 优先做博客截图友好，而不是功能调试感
- 用户在此基础上又进一步更新了产品故事：
  - 左侧一个可拖动的 Lynx Logo SVG
  - 右侧一个抽象的 Desktop SVG
  - 用户将 Lynx Logo 拖到 Desktop 中
  - drop 成功后 Logo 停在 Desktop 中央即可
  - cursor 语义改为 `grab / grabbing`
- 因此当前海报版 `pc-mouse-cursor` 视为中间里程碑，不作为最终展示态
- 该拖拽版本现已实现并通过 PM 复核：
  - `28f81e7` 完成了 drag-to-desktop 重构
  - build 已通过
  - 真实运行态截图已确认新的单屏故事成立
  - DOM 已确认 drop success 状态：
    - `LogoCard--docked`
    - `DesktopFrame--occupied`
- 用户在真实查看后提出新的视觉问题：
  - draggable source 现在太接近正方形，不像 banner 形状
  - drop target 跑到拖拽区域之外，主画面里被裁切，看不出完整目标
  - 因此当前 drag/drop 构图仍不通过产品验收
- 该问题现已修正：
  - 主舞台收敛为明确的横向长方形 banner
  - 左侧为 source panel，右侧为 drop zone
  - source 与 target 都完整落在主画面内，不再需要脑补可视范围
  - PM 已用真实运行态与 DevTool 截图复验通过
- 在此基础上继续完成了一轮视觉 polish：
  - 参考 `lynx-examples/hello-world` 的海报式背景与层次
  - 补入 `Source / Desktop` 标签、中轴导轨和更克制的舞台 glow
  - 左侧拖拽素材从 SVG 切到 PNG，以规避当前 Lynx SVG 组件限制
  - `pnpm --dir showcases/pc-mouse-cursor build` 已通过，并用真实运行态截图复验了新视觉层次

### Next Action

- 继续推进 `pc-mouse-cursor` 的 thumbnail / registry / gallery 集成

### TODO

- 升级 `rspeedy` / `@lynx-js/react-rsbuild-plugin` / `@lynx-js/template-webpack-plugin`
  - 目标：正式支持 `pluginReactLynx({ alignMouseEventWithW3C: true })`
  - 当前结论：本地验证时该字段需要依赖 `node_modules` 补丁，不能作为正式可提交方案长期保留
- 升级 Lynxtron runtime
  - 目标：重新验证 Example Artifact 链路，彻底排除历史 `TextEncoder` / `TextDecoder` 混淆
  - 当前结论：项目基线已经将 `preload.ts` 视为标准 Node.js + Lynxtron APIs，但仍需要在升级后的 runtime 上做一次完整回归

### Follow-up

- 已确认 loading overlay 引入后出现 IDE 主工作区纵向布局回归：`IDEStage` 满高，但 `IDEBody` 被压缩到内容高度
- 该问题已定位为 `IDEStage` 引入后 flex 链断裂，不是 loading 视觉组件本身的问题
- 已通过独立提交 `2b988c3` 修复，当前运行态中 `IDEStage` 与 `IDEBody` 都恢复为满高
- 当前阶段收口后，下一条产品主线切换为 Lynxtron GO 的基础 navigation / route 设计
- Navigation / Route Foundation 的 Step 2 已完成接受：`Open Example Artifact` 已通过 route boundary 进入临时 workspace，并继续保持默认文件打开行为

### Follow-up

- `feat-navigation-route-foundation` 的 Step 1 已完成并提交为 `34a0634`
- 当前 route 基础层已经具备 `home / workspace` 主视图模型与集中导航边界
- `feat-navigation-route-foundation` 的 Step 2 已完成并接受：`Open Example Artifact` 已通过 route boundary 进入临时 workspace，并继续保持默认文件打开行为
- `feat-navigation-route-foundation` 的 Step 3 已完成并提交为 `9ece289`，当前已具备不依赖键盘注入的受控 direct-route debug entry
- `feat-navigation-route-foundation` 的 Step 4 已完成，当前阶段收口结束；下一步是基于这一层接入 scheme 跳转和更稳定的 UI 自动化入口

### Follow-up

- 新发现 Run 语义回归：进入 example artifact workspace 后，Run 主链路没有按 source 分流到 example runner
- 代码现状已确认：
  - `runExampleArtifact(...)` 与 `pickExampleArtifactRunTemplate(...)` 仍然存在
  - 当前主 Run 入口仍默认走 showcase 语义，缺少 `route.source === 'example-artifact'` 的专用分支
- 已新增 workflow：`docs/workflows/2026-04-03-fix-example-artifact-run-regression.md`
- 当前验收目标已经冻结：
  - example artifact Run 必须走 `LynxWindow.loadFile(...)`
  - showcase Run 行为必须保持不变
  - 不接受用“伪装成 showcase”方式规避语义问题

### Next Action

- 派发子代理修复 example artifact 的 route-aware Run 链路
- 要求其补最小测试/验证，并提供 focused smoke 证据
- PM review 后决定接受、打回或追加 follow-up

### Follow-up

- 用户已修改产品决策：
  - Run 语义不应主要依赖 route/source 推断
  - IDE mode 应在打开时由命令显式决定，并作为 IDE 自身属性保存/传递
  - IDE 应拆成独立组件/文件，和首页分离
- 因此当前修复任务的实现方向从“route-aware Run”调整为“explicit IDE mode + Home/IDE split”
- PM 将中断已派发子代理，并要求其按新边界重做实现与验证

### Follow-up

- Example Artifact Run 回归修复代码已按新方案落地：
  - Run 主链路改为消费显式 `ideMode`
  - `exampleArtifact.run(...)` 已通过 preload 暴露并接入主 Run
  - `Home` 与 `IDE` 已拆为独立组件/文件
  - route 仅保留主视图切换，不再承担 Run 语义判断
- PM 复核结果：
  - `pnpm --dir lynxtron-go test src/app/example-artifact.test.ts` 通过，14/14
  - `pnpm --dir lynxtron-go build` 通过
  - code review 确认：`showcase` / `folder` / `example-artifact` 三类 mode 均由打开链路显式写入
- 当前阻塞：
  - live smoke 仍未闭环
  - 运行时拉起后页面为空白，Lynx session 只有根 `page`，`__ide_*` debug hooks 未挂出，暂时无法完成“真实打开 example artifact 后触发 Run”的最终行为证据
- 当前结论：
  - 实现与本地代码级验证通过
  - 任务不能标记为完全验收完成，需把 live smoke 阻塞单独跟踪

### Next Action

- 由 PM 决定下一步是继续追空白页 / session 初始化问题，还是先保留当前代码并把 smoke 阻塞作为独立 runtime 问题跟踪

### Follow-up

- PM 已再次重试 live smoke，这次通过
- 使用的验证链路：
  - 重新启动 `lynxtron-go/dist/desktop`
  - 使用 Lynx DevTool `Runtime.evaluate` 直接执行 `__ide_debugOpenExampleArtifactRoute("view")`
  - 确认 DOM 从 `GalleryHome` 切到 `IDEBody`，并进入 example artifact workspace
  - 再执行 `__ide_debugRunCurrentWorkspace()`
- 关键证据：
  - DOM 中出现 example workspace 的缓存根目录与文件树
  - Output / 状态栏显示 `Example loaded: view`
  - `/tmp/lynxtron_debug.log` 记录：
    - `exampleArtifact.run: cachePath=... templateFile=dist/main.lynx.bundle title=examples/view — main`
    - `launcher starting: examples/view — main`
    - `LynxWindow created`
    - `loadFile invoked: .../dist/main.lynx.bundle`
  - `pgrep` 可见独立 runner 进程指向 `.lynxtron-launcher/dist/desktop`
- 当前结论更新为：
  - Example Artifact Run 回归修复已完成并通过 live smoke
  - 新的显式 `IDE mode` 边界有效，Run 不再依赖 route/source 推断

### Next Action

- 将这次修复视为已完成收口
- 如需继续，可转入下一条产品主线或单独跟踪 runner 生命周期/退出行为等非阻塞细节

## 2026-04-08

### Active Task

清理并收口遗留未提交改动，将其按真实功能线拆分提交。

### Progress

- 已将 `example-artifact / ide-mode / route` 线单独收口
- 已确认剩余提交候选主要分为：
  - `alpha.14` runtime 基线对齐
  - `cross-platform-notes` desktop 稳定性修补
  - `pc-mouse-cursor` registry / workspace lock 同步
- 已确认 repo 根的 native extension 文件不是临时垃圾，而是两个 extension 包 `prepare.js` 生成并互相覆盖后的副产物；该线需单独判断，不再按普通清理项处理

### Verification

- `pnpm run generate-registry`
- `pnpm --dir packages/config build`
- `pnpm --dir showcases/benchmark build`
- `pnpm --dir showcases/cross-platform-notes build`

### Next Action

- 继续将剩余改动拆成独立提交：
  - alpha.14 runtime baseline
  - cross-platform-notes desktop stability
  - pc-mouse-cursor registry / workspace lock sync

### Follow-up

- repo 根残留的 native extension 文件已被确认为两个 extension 包 `prepare.js` 复制出来并互相覆盖后的副产物：
  - `CMakeLists.txt`
  - `bindings/`
  - `module/`
  - `index.cjs`
- 这些文件不是 source-of-truth，且当前根目录版本内部不一致：
  - Scintilla 与旧 text-editor 绑定混在一起
  - `index.cjs` 指向的目标名与 CMake target 不匹配
  - `scintilla/` 子树也缺失
- source-of-truth 仍保留在：
  - `lynxtron-go/extension`
  - `lynxtron-go/scintilla-extension`
- 因此本轮清理中已删除 repo 根的冲突副本，仅保留 package 内原始工程

### Follow-up

- 新发现 Lynxtron GO 的 TypeScript diagnostics 假阳性问题，已冻结为独立任务：
  - showcase 的 Lynx UI `tsx` 文件会被 IDE 误报 `react/jsx-runtime` 相关错误
  - 部分 desktop host / web host 文件也会因错误的项目上下文出现误报
  - 但对应 showcase 的实际 `build` 可以通过，说明是 IDE diagnostics 与真实项目语义不一致
- 已完成初步复现与原因收敛：
  - [showcases/counter/src/app/App.tsx](/Users/bytedance/ws2/lynxtron-show-cases/showcases/counter/src/app/App.tsx) 与 [showcases/cross-platform-notes/src/app/App.tsx](/Users/bytedance/ws2/lynxtron-show-cases/showcases/cross-platform-notes/src/app/App.tsx) 均可复现 `TS2875`
  - 当前 `TypeScriptLanguageService` 找不到就近 `tsconfig.json` 时会退回通用 fallback 选项，[lynxtron-go/src/extension-host/language-server/typescript.ts](/Users/bytedance/ws2/lynxtron-show-cases/lynxtron-go/src/extension-host/language-server/typescript.ts#L79)
  - fallback 选项不符合 showcase 的 Lynx UI / desktop host / web host 真实语义
  - 当前 program root 主要由“已打开文件”构成，ambient `.d.ts` 没有按项目 `include` 稳定进入 program
- 已新增 workflow：
  - `docs/workflows/2026-04-08-fix-showcase-ts-diagnostic-false-positives.md`

### Next Action

- 先完成这条 diagnostics 问题的 repro matrix 与方案冻结
- 再派发 subagent 以最小范围修复：
  - project discovery / tsconfig 策略
  - ambient `.d.ts` 纳入 program
  - app / desktop / web 三类文件的语义对齐

### Follow-up

- repro matrix 已完成，当前影响面已收敛为三类 slice：
  - showcase app `tsx`
  - showcase desktop host `ts`
  - showcase web host `ts` + ambient `.d.ts`
- PM 已冻结推荐修复路径为组合方案：
  - 为各 showcase slice 补显式 `tsconfig`
  - TS diagnostics service 优先按这些 tsconfig 建立 project
  - program root 不再只靠当前打开文件，而是纳入 tsconfig `include` 覆盖的 `.ts` / `.tsx` / `.d.ts`
- 已确认 `@lynx-js/react` 与 `@lynx-js/types` 本身提供了正确的 JSX runtime 与 `IntrinsicElements`
  - 因此 app / web 误报的主因不是包缺类型，而是 IDE diagnostics 没有拿到正确项目上下文
- desktop host 还存在一个独立外部问题：
  - `@lynx-js/lynxtron` 根 `exports` 未显式导出 types
  - 在尊重 `package.json exports` 的解析模式下会产生 typing 误报
  - 该项已单独记入 framework issues，不与本仓库 app / web tsconfig 修复混淆

### Next Action

- 下一步进入实现派发前的最后准备：
  - 定义 showcase app / desktop / web 三类 tsconfig 模板
  - 明确 TS diagnostics service 如何发现并加载这些 tsconfig
  - 决定 desktop host 的 upstream typing 问题是先做本地 shim 还是单独留作 blocker

### Follow-up

- showcase app / web 两类 slice 的最小模板已完成本地验证：
  - app 使用 `jsxImportSource: @lynx-js/react` + `types: ["@lynx-js/types"]` + `strict: false`
  - web 使用显式 `include` 把 ambient `.d.ts` 纳入 program
  - 两类场景在实验性 project config 下都已可降为 `0` diagnostics
- desktop host 的建议模板已收敛为 `module/moduleResolution: NodeNext` + `types: ["node"]`
  - 但当前实验性 TypeScriptLanguageService 环境下仍残留 `path` / `__dirname` 相关问题
  - 因此 desktop host 本轮按 best-effort 处理，不阻塞 app / web 主修复链路
- workflow 已补充：
  - 三类 tsconfig 最小模板
  - implementation write set
  - app / web 优先、desktop host best-effort 的执行顺序

### Next Action

- 进入 Step 3 的实现派发准备：
  - worker 先落地 showcase app / web tsconfig 与 TS service project discovery
  - PM 再根据结果决定 desktop host 是补本地 shim 还是保留为外部 blocker

## 2026-04-10 - Lynxtron GO Scheme / Local Registry Follow-up

### Current State

- `lynxtron://` deep-link 主链路已经打通到 GO 内部动作分发：
  - host 早期接入 `open-url` / `second-instance` / `process argv`
  - UI 可以稳定消费 pending deep-link payload
  - `home / showcase / example` 三类动作都已落到统一 dispatch 边界
- 本地运行失败的根因已从“bridge 是否联通”收敛为“registry source 是否正确”：
  - 早期本地构建把 showcase registry bake 成了空 `url`
  - `openShowcaseEntry()` 因 `entry.url` 为空而直接返回
- 现已把 showcase source 明确拆成三种模式：
  - `remote`: 默认/发布路径，bake GitHub tree URL
  - `local-registry`: 本地预发布测试路径，bake `file://...tgz`
  - `local-workspace`: 仅供 runtime debugging 的源码 workspace fallback

### Verification

- focused tests passed:
  - `pnpm --dir lynxtron-go exec vitest run src/shared/deep-link.test.ts src/app/shared/deep-link-dispatch.test.ts src/app/shared/deep-link-bridge.test.ts src/app/shared/deep-link-runtime.test.ts`
- scoped default build passed:
  - `pnpm --dir lynxtron-go build`
  - 日志显示 `sourceMode=remote`
- local-registry preview build passed:
  - `bash scripts/preview.sh --no-launch`
  - 本地 registry、showcase tarball pack、GO build 全部通过
  - 构建产物中的 baked showcase URL 已切换为 `file://...tgz`
- un-packaged deep-link smoke passed through local-registry path:
  - cold start: `lynxtron ... lynxtron://showcase/open?id=benchmark`
  - `/tmp/lynxtron_debug.log` 记录：
    - `deep link applying showcase action: benchmark [startup]`
    - `showcase.fetch: ... url=file:///.../benchmark-0.0.1.tgz`
    - `openFolder: /Users/bytedance/.lynxtron-go/showcases/benchmark`

### Remaining Blockers

- packaged app protocol smoke 仍未完成，因此 workflow 总状态保持 `follow-up needed`
- `pnpm --dir lynxtron-go run pack` 的 builder / dependency path 问题仍需单独收尾

### Next Action

- 保持默认 release 构建走 `remote`
- 在 repo 未 public 之前，用 `local-registry` 模式继续做 deep-link / showcase fetch / preview smoke
- repo public 且正式发布链路稳定后，删除 `local-registry` / `local-workspace` 专用分支

## 2026-05-08 - Windows Bring-Up

### Current State

- Windows bring-up is now tracked in `docs/workflows/2026-05-08-chore-windows-bringup.md`.
- Lynxtron package baseline was moved from `3.9.1-alpha.0-oss` to `4.0.0-alpha.2-oss` across GO and showcases after confirming the newer `4.0.0-alpha.3.oss` Windows runtime artifact is not available.
- Preview entrypoints now use `node scripts/preview.mjs`, avoiding the previous WSL-only `bash` dependency on Windows.
- Lynxtron GO's Scintilla native editor extension is now optional outside macOS. Windows builds skip the Cocoa native module instead of compiling `.mm` files with MSVC.

### Verification

- `pnpm install` completed on Windows and downloaded `lynxtron-v4.0.0-alpha.2-oss-win32-x64.zip`.
- `pnpm ignored-builds` reported no automatically ignored builds.
- `pnpm --filter @lynxtron-showcases/cli test` passed on Windows.
- `pnpm --dir lynxtron-go test` passed on Windows.
- `pnpm --dir lynxtron-go run build` passed on Windows.
- `pnpm preview:build` passed on Windows and produced `lynxtron-go/dist/desktop/main.js` plus `main.lynx.bundle`.
- Direct launch with the downloaded `dist/win32/x64/lynxtron.exe` started Lynxtron GO; logs include `LynxWindow created`.

### Remaining Blockers

- Windows Scintilla native editor support was implemented in the 2026-05-09 follow-up workflow; keep this section for the original bring-up baseline.
- `@lynx-js/lynxtron-builder` postinstall invokes `patch-package` and prints a missing `app-builder-lib` patch warning, but exits 0. Packaging should still get a dedicated Windows smoke before release.

### Next Action

- Perform a hands-on Lynxtron GO gallery smoke on Windows: open a showcase from the baked registry, fetch it, run it, and stop it from the Run menu.
- Decide whether to stay on `4.0.0-alpha.2-oss` for Windows until a newer runtime artifact is published.

## 2026-05-09 - Windows Scintilla Extension

### Current State

- Windows Scintilla native editor work is tracked in `docs/workflows/2026-05-09-feature-windows-scintilla-extension.md`.
- The Scintilla extension now builds on Windows with the Win32 Scintilla backend instead of skipping as macOS-only.
- CMake compiles platform-specific backend sources: Cocoa on macOS, Win32 on Windows.
- The Windows `.node` addon links against `node.lib` and the Lynxtron Windows import library from `@lynx-js/lynxtron@4.0.0-alpha.2-oss`.
- Lynxtron GO copies the built `lynx_scintilla_module.node` into `dist/desktop/node_modules/lynxtron-scintilla-editor/build/Release/`.

### Verification

- `pnpm --dir lynxtron-go/scintilla-extension run build` passed on Windows and produced `build/Release/lynx_scintilla_module.node`.
- `pnpm --dir lynxtron-go run build` passed on Windows and copied the native module into the desktop runtime output.
- `pnpm --dir lynxtron-go test` passed on Windows.
- `pnpm preview:build` passed on Windows and rebuilt the native addon as part of the preview flow.
- Direct launch with `lynxtron.exe ./dist/desktop` after preview build started Lynxtron GO, and logs include `ScintillaEditor extension registered`.

### Remaining Blockers

- Hands-on editor smoke should still open a real workspace file and verify typing/save behavior in the native Win32 Scintilla control.
- `captureWindow` / `captureWindowToBase64` remain macOS-only; the Windows backend currently returns `false` / empty string for those debug capture helpers.

### Next Action

- Add a focused manual/editor smoke note once a file-backed workspace is opened and edited on Windows.

## 2026-05-09 - Windows Scintilla Open-File Crash

### Current State

- Fixed the Windows crash triggered by opening a file in Lynxtron GO.
- Root cause was narrowed to the editor open path:
  - ArrayBuffer arguments to `NativeModules.ScintillaExtensionModule.setStyles` crash the Windows PrimJS NativeModules bridge before entering the addon callback.
  - Initial `setText` could race with Win32 child HWND creation, dropping the first file contents.
- Windows now sends native style/indicator byte payloads as base64 strings, avoiding the crashing ArrayBuffer bridge path while keeping syntax highlighting and diagnostic squiggles enabled.
- The Win32 Scintilla backend now queues content until the Scintilla HWND is created.

### Verification

- `pnpm --dir lynxtron-go run build` passed with `LYNXTRON_SHOWCASE_SOURCE=local-registry`.
- Deep-link preview smoke opened `benchmark/lynx.config.ts` without crashing.
- Smoke logs confirm `getText length=152`, `gotoLine result=true`, `setSelection result=true`, and `scrollCaret result=true`.
- `pnpm --dir lynxtron-go test` passed: 13 files, 155 tests.
- User hands-on preview smoke verified the native Win32 editor renders normally after the owned-popup repaint fix.
- `pnpm --dir lynxtron-go test` passed after restoring Windows style transport: 14 files, 159 tests.
- `pnpm --dir lynxtron-go run build` passed after restoring Windows style transport.
- `pnpm --dir lynxtron-go run build` passed after adding owner-window move/resize tracking for the Scintilla overlay.

### Remaining Blockers

- Large-file syntax payload size should be watched on Windows because base64 is larger than the original ArrayBuffer transport.
