# Lynxtron Showcases — Product Plan

## 1. 定位

**Lynxtron 是 Lynx 生态的桌面延伸，不是 Electron 替代品。**

目标用户：
- **Lynx 开源社区** — 外部开发者评估是否用 Lynx 做跨端
- **桌面应用开发者** — 在找 Electron 替代方案

核心叙事通过三个 slogan 传达：
1. **Light-weight and fast** — 58MB vs 161MB，更小更快
2. **Native extensible** — 原生组件一等公民，不是 hack
3. **Cross platforms** — 桌面 + Web + 移动端原生，一份 Lynx UI 代码全覆盖

用户触点：从 Lynx 官网或技术博客/社交媒体过来，已经对 Lynx 有兴趣但还没决定用不用。Showcase 的作用是让他们从"有兴趣"变成"想试试"。

## 2. 实测数据

| | **Lynxtron** | **Electron (Fiddle)** | 差距 |
|---|---|---|---|
| Framework binary | 58MB | 161MB | **Lynxtron 小 64%** |
| App 总大小（解压后） | ~60MB | 268MB | **Lynxtron 小 78%** |
| Zip 下载 | 65MB | ~92MB | **Lynxtron 小 29%** |

注：Lynxtron 176MB 的表面数字是 zip 解压后 symlink 被展开为 3 份拷贝导致的 bug（已修复）。

## 3. Showcase 体系

### 3.1 三个核心 Showcase

每个 Showcase 对应一个 slogan，讲一个故事：

#### Showcase 1: Benchmark Dashboard — "Light-weight and fast"

一个交互式性能仪表盘，app 本身就是证据。

- **Size 对比卡片** — 58MB vs 161MB 可视化柱状图，实时读取本机 lynxtron.app 大小
- **滚动性能** — 10,000 项长列表，快速滑动，顶部实时 FPS
- **动画压测** — 100+ 同时运动的元素（弹跳球/粒子），展示高负载流畅度
- **启动时间** — 显示 app 启动到首帧的毫秒数

核心信息：用户 3 秒看到数据对比，10 秒通过滑动/动画亲手感受"快"。

#### Showcase 2: Native Texture Canvas — "Native extensible"

一个画板 app 内嵌 native canvas，Lynx UI 统一协调画笔、颜色、透明度和清空等交互。

- **Native canvas** — 原生 Cocoa 绘制画笔轨迹，作为画布展示层
- **Lynx 工具栏** — 颜色、笔刷大小、透明度、清空操作由 Lynx UI 驱动
- **Host bridge** — preload 暴露最小宿主信息，native extension 暴露画布控制 API
- **打包验证** — native module 随 showcase dist 一起复制，保持 preview 的 packed artifact 消费模型

核心信息：Lynx UI 负责交互编排，native texture/canvas 负责高性能绘制展示。Electron 做 native view 嵌入需要 BrowserView hack，Lynxtron 是一等公民。

#### Showcase 3: Cross-Platform Notes — "Cross platforms"

一个 Markdown 笔记应用，同一份代码跑桌面和浏览器。

- **左侧笔记列表** — 本地文件/localStorage 存储
- **右侧 Markdown 编辑器** — 先把同一套 UI 在桌面和 Web 跑通，预览不是 MVP 必需项
- **底部平台信息栏** — 显示当前 Desktop/Web + runtime 版本
- `npm start` 桌面窗口，`npm run start:web` 浏览器，UI 完全一致
- 提示信息："This app's UI code runs on Desktop (Lynxtron), Web (Browser), and Mobile (Lynx iOS/Android) — same code, native rendering on every platform."

核心信息：你的 UI 代码不仅跑桌面和 Web，还能原生跑移动端——Electron 做不到。

### 3.2 已有 Showcase

- **Counter** — Quick Start，最小可运行示例
- **Lynxtron GO** — Real App，IDE playground + showcase runner

### 3.3 每个 Showcase 标准交付物

```
showcases/<name>/
  package.json          # showcase 元数据 + 依赖
  lynx.config.ts        # Lynx UI 构建
  rspack.config.ts      # Host 构建（desktop + 可选 web）
  README.md             # 展示什么 + 如何运行
  thumbnail.png         # Lynxtron GO gallery 缩略图
  src/
    app/                # Lynx UI（平台无关）
    main/
      desktop/          # 桌面 host
      web/              # Web host（如果跨端）
```

## 4. Lynxtron GO 的角色

Lynxtron GO 是**展示平台**，不是核心卖点。

**当前定位：** Fiddle-like playground
**目标定位：** Showcase Gallery + Runner

近期改进：
- 启动后显示 showcase gallery（不是空白 IDE）
- 每个 showcase 卡片有缩略图 + 描述 + "Run" 按钮
- 点击 "Run" 直接启动

不做：
- 不做成完整 IDE（不跟 VS Code 竞争）
- 不做在线编辑器（dev mode 后续做）

## 5. 呈现形式

**Lynxtron GO 内置 gallery + 每个 showcase 可独立运行（C 模式）**

- Lynxtron GO 作为统一入口，打开即看到所有 showcase
- 每个 showcase 也可以独立 clone + `npm start` 运行
- 方便两种用户：快速体验者（用 Lynxtron GO）和深入学习者（clone 代码）

### 5.1 新增能力：Example Artifact URL 打开

Lynxtron GO 需要支持打开一个通过静态 HTTP 发布的 Lynx example artifact，而不要求它先被包装成 Lynxtron showcase。

该能力的目标不是把 example artifact 伪装成 showcase，而是让 Lynxtron GO 作为 **Lynx UI example 消费方**，直接消费符合 example 发布协议的远程产物。

最小版本能力定义：

- 通过扩展命令输入 example 相对路径 / example id
- example 根地址使用源码中的集中配置常量，不向用户暴露完整 URL 输入
- 每次打开都重新拉取 `example-metadata.json` 与关联文件
- 下载结果落到本地临时缓存目录，并在退出该工程后清理
- 在 IDE 中展示协议里的全部 `files`
- 点击 Run 后弹出 `LynxWindow`，加载 `templateFiles[*].file` 指向的 Lynx bundle
- `webFile` 留到后续和 Cross-Platform Notes 一起支持 Web 运行

明确不做：

- 不要求 example artifact 必须具备 Lynxtron desktop host
- 不把它塞进当前 showcase fetch/run 语义，避免模型混淆
- 不在第一版要求二维码、移动端分发、多入口高级切换全部完善
- 不做长期缓存、版本/hash 复用与命中策略

### 5.2 新增能力：Lynxtron GO 基础 Navigation / Route 层

Lynxtron GO 现在已经同时承载：

- showcase gallery
- 本地 folder workspace
- showcase workspace
- example artifact workspace

继续只靠 `App.tsx` 中的布尔值和局部状态切换视图，已经不利于后续能力演进。下一阶段需要引入一个 **轻量内部 route/navigation 模型**，不是为了网页式路由，而是为了：

- 统一 `home -> workspace` 这一类主视图切换
- 为后续 `lynxtron://` scheme 跳转提供稳定入口
- 为 UI 自动化和 smoke 验证提供“直接进入目标状态”的能力
- 减少对 `Cmd+P` / 命令面板 / 键盘注入的依赖

第一版 route 只管理 **主视图状态**，不管理 tooltip、picker、loading、toast 等短生命周期 UI。

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

第一版不要求：

- 浏览器式 history/back stack
- 完整前端 router 框架
- 所有临时 UI 状态都 route 化
- 立即支持完整 URL scheme

但实现必须为后续 scheme 映射预留稳定边界，例如：

- `lynxtron://home`
- `lynxtron://showcase/open?id=benchmark`
- `lynxtron://example/open?path=view`
- `lynxtron://folder/open?path=/abs/path`

补充产品决策：

- route 负责主视图切换，但 **Run 语义不由 route 推断**
- IDE 的运行模式应是打开时就确定的显式属性，例如 `showcase` / `example-artifact` / `folder`
- `Home` 与 `IDE` 应保持清晰组件边界；首页不是 IDE 内部的一个特殊分支

### 5.2.1 新增能力：IDE 路由前进 / 回退按键

在 route foundation 已经落地后，Lynxtron GO 需要在 IDE workspace 里提供可见的主视图导航控件，让用户不依赖 deep link、命令面板或重新启动就能从 IDE 返回 showcase gallery home。

最小版本能力定义：

- IDE 模式中展示 Back / Forward 两个紧凑路由按钮
- Back 从当前 workspace 返回 `home`
- Forward 在一次 Back 之后回到刚才的 workspace，并保留 workspace source、root、active file 与当前已打开 tab 状态
- Back 返回 `home` 后，当前 active workspace session 必须被清空，避免 Run / Debug 在首页误操作隐藏 workspace
- Forward 回到 workspace 时，恢复对应 `WorkspaceSession`，Run 语义继续由显式 workspace session / run target 决定
- 打开新的 folder / showcase / example workspace 后，清空旧的 forward 目标
- 按钮必须有清晰 disabled 状态：没有可回退目标时 Back 不可用，没有可前进目标时 Forward 不可用

明确不做：

- 不做文件内跳转历史、tab 历史、editor cursor 历史
- 不引入浏览器式 URL history 或第三方 router
- 不让 route 推断 Run 语义
- 不把导航按钮放进 StatusBar；StatusBar 继续只承载状态信息

### 5.3 新增能力：Lynxtron GO URL Scheme 打开

Lynxtron GO 需要支持被外部链接通过 custom scheme 唤起，并把 URL 映射为 GO 内部稳定的打开动作。

该能力的目标不是再做一套“命令字符串”，而是让官网、博客、文档或本地脚本可以直接把用户带到指定 showcase 或 Lynx example，减少“先打开 GO，再手动找目标”的摩擦。

最小版本能力定义：

- scheme 名称收敛为 `lynxtron://`
- 支持以下稳定 URI 形状：
  - `lynxtron://home`
  - `lynxtron://showcase/open?id=<showcase-id>`
  - `lynxtron://example/open?path=<example-relative-path>`
- `showcase/open` 与 `example/open` 额外支持文件导航 query：
  - `file=<workspace-relative-path>`
  - `line=<1-based-line-number>`
  - `column=<1-based-column-number>`，可选
- `showcase-id` 只接受 baked-in registry 中的稳定标识，不接受任意远程 URL
- `example path` 复用现有 Example Artifact 的相对路径模型，不接受完整 URL
- 若 Lynxtron GO 已在运行，应优先复用当前主窗口并切换到目标状态，而不是再开一个第二 IDE 窗口
- 若 Lynxtron GO 尚未运行，主进程需要在 app 启动早期接收 URL，并在 UI ready 后把意图分发给 route / IDE 打开链路
- 第一版只要求“打开到目标 home / workspace”，**不要求自动 Run**
- 若给出 `file`，则在 workspace 打开后继续打开对应文件
- 若给出 `line`，则滚动并高亮整行；`column` 只影响落点列号，不改变“整行高亮”的产品语义
- 解析失败、目标不存在、参数缺失都必须给出可理解提示，不能静默失败

规范示例：

- `lynxtron://showcase/open?id=cross-platform-notes&file=src/app/App.tsx&line=42`
- `lynxtron://showcase/open?id=cross-platform-notes&file=src/app/App.tsx&line=42&column=7`
- `lynxtron://example/open?path=view&file=src/App.tsx&line=18`

明确不做：

- 第一版不做 `folder/open`、`bundle.runUrl`、`bundle.runFile` 的 scheme 暴露
- 第一版不做自动运行，例如 `?run=1`
- 第一版不做多文件、多位置或跨 workspace 导航
- 第一版不做任意 showcase URL 或任意 example 完整 URL 输入，避免与现有命令模型混淆
- 第一版不要求同时覆盖 macOS / Windows / Linux；先以 desktop 主支持平台为准，其他平台后续补齐
- 第一版不要求浏览器 history、back stack 或多窗口会话恢复

补充产品决策：

- 外部 scheme 只负责“把用户带到正确 workspace / home”，不直接决定 Run 语义
- host 层应把 OS 事件归一成一个稳定的 deep-link payload，再交给 UI；不要把 `open-url`、命令参数解析和 workspace 打开逻辑耦在一起
- `file` 明确只接受 workspace 内相对路径；归一化后若逃逸出 workspace root，按非法参数处理
- `line`、`column` 对外都使用 1-based 语义；内部 editor 如使用 0-based，需要在边界层统一转换
- `column` 只有在 `line` 存在时才合法；`line` 或 `column` 只有在 `file` 存在时才合法
- 若只给 `file`，打开文件但不强制高亮
- 若目标文件不存在，仍进入 workspace，但要给出明确错误
- 若 `line` 或 `column` 超出文件范围，打开文件并钳制到最后可用位置；整行高亮仍以实际落点行生效
- 需要兼容冷启动和热启动两条链路：
  - macOS `open-url`
  - single-instance 场景下的 `second-instance`
- 当前打包配置里已经存在一个 macOS URL scheme 占位项 `LynxtronIDEMVP`，但它还没有和主进程的 URL 分发链路打通；后续需要统一到正式命名

### 5.4 新增能力：当前文件内搜索

Lynxtron GO 现有 Search panel 已支持 workspace 级 `Search in files`，但在阅读单个 showcase 或 example 文件时，用户还需要标准的当前文件查找工作流。

该能力的目标是补齐轻量 workspace shell 的基本编辑体验，而不是把 GO 扩展成完整 IDE。

最小版本能力定义：

- `Cmd+F` / `Ctrl+F` 打开当前文件查找条
- 查找范围仅限当前 active tab 的文本内容
- 输入查询词后即时计算匹配数量
- Enter 跳到下一项，Shift+Enter 跳到上一项
- 查找条提供上/下一项按钮、关闭按钮和 `current / total` 计数
- 当前匹配项必须通过 editor selection 或等价视觉方式高亮并滚动到可见位置
- 切换 tab、关闭 tab、关闭查找条时，查找状态必须与当前 active file 保持一致
- 空查询、无 active file、无匹配都必须有明确但不打扰的状态反馈
- 查找条 UI 与交互状态优先在 Lynx 前端实现；host/native 只负责快捷键事件和复用既有 editor navigation 能力

明确不做：

- 本轮不做替换
- 本轮不做正则、大小写开关、整词匹配、多光标选择
- 本轮不改动现有 workspace 级 Search panel / `Cmd+Shift+F` 语义
- 本轮不新增原生 UI；不新增原生 Scintilla extension API，除非现有前端状态与既有 selection / navigation 能力无法满足 MVP

### 5.5 维护项：仓库 Dead Code 清理

本轮目标是清理仓库中可证明未引用的源码和配置残留，范围覆盖 Lynxtron GO、showcases、packages 与 repo scripts。该任务是维护项，不改变产品功能、artifact 模型或 runtime 入口。

验收口径：

- 只删除有静态引用证据支撑的 dead code，包括未引用文件、未引用 helper、未引用样式、过期测试 fixture、失效脚本或未使用依赖。
- 动态入口默认视为 live code，包括 package `main/bin/files/scripts`、Rspack/Rspeedy entry、Lynxtron preload bridge、native extension binding、showcase metadata、registry 输入、缩略图和文档引用。
- 不把 `node_modules`、`dist`、`output`、cache 目录或本地 ignored 残留纳入源码 dead code 清理。
- 每个清理子任务必须记录删除依据、验证命令和未删除的可疑候选。
- 任何 Lynx UI 代码清理不得引入 HTML/DOM/BOM 语义回退。

执行 workflow：

- `docs/workflows/2026-05-18-chore-dead-code-cleanup.md`

## 6. 执行路线

### Phase 1：Benchmark Dashboard（最快出效果，纯 Lynx UI）
### Phase 2：Cross-Platform Notes（验证跨端能力，桌面 + Web 同一份 Lynx UI 代码）
### Phase 3：Native Texture Canvas（需要 C++ 开发，最复杂）
### Phase 3.5：Example Artifact Consumption（让 Lynxtron GO 直接打开远程 Lynx UI example 产物）
### Phase 4：Navigation / Route Foundation（为 scheme 跳转和自动化验证打基础）
### Phase 4.5：URL Scheme Handler（让外部链接稳定进入 home / showcase / example）
### Maintenance：Dead Code Cleanup（清理可证明未引用源码，不改变 runtime 行为）

### 当前状态（2026-04-02）

- **Runtime 验收基线**：`@lynx-js/lynxtron@0.0.1-alpha.14`
- **Node / 安装前置**：Node.js `>= 22`，并要求 pnpm 允许 `@lynx-js/lynxtron` 与 `@lynx-js/lynxtron-builder` 执行 build scripts
- **Lynxtron GO**：默认首屏已切为 showcase gallery，desktop runtime 已验证通过
- **Benchmark Dashboard**：interactive performance demo 已落地，desktop runtime 已验证通过
- **Native Texture Canvas**：画板 app 已替换 System Info + File Preview，`pnpm --dir showcases/native-texture-canvas run build` 已验证通过
- **Cross-Platform Notes**：desktop + web MVP 已完成，desktop runtime / web service-level / registry / gallery 均已验证
- **Preview tooling**：`pnpm preview:build` 已恢复；`pnpm preview` 已通过最小 smoke，local registry 改为使用仓库内 verdaccio 并放宽 readiness 等待

### 当前剩余项

- 将 runtime 非致命 warning（如 `MainPartsDelegate not found in registry.`）单独作为框架健康性问题跟踪
- 继续做展示层 polish，包括 benchmark 文案/版本号统一与 gallery 元信息一致性检查
- 为 Lynxtron GO 的 Example Artifact 打开能力补即时 loading / status 反馈，减少从命令提交到 IDE 切换之间的感知空窗
- 为 Lynxtron GO 引入轻量 route/navigation 层，统一 `home / workspace` 视图切换，并为 scheme 跳转与 UI 自动化预留稳定入口
- 为 Lynxtron GO 实现 `lynxtron://` scheme handler，优先支持 `home / showcase / example` 三类打开动作
- 为 Lynxtron GO 的 `showcase/open` 与 `example/open` deep link 增加 `file / line / column` 查询参数，支持打开后直接定位并高亮目标行
- 为 Lynxtron GO 补齐当前文件内搜索：`Cmd+F` 打开查找条，支持当前文件匹配计数、上/下一项导航和当前匹配高亮
- 修复 Example Artifact workspace 的 Run 语义回归：example / 纯 Lynx UI 产物必须走 `LynxWindow.loadFile(templateFiles[*].file)`，不能误走 showcase 的 `dist/desktop` 运行链路
- 将 Lynxtron GO 的首页与 IDE 进一步拆边界：IDE 作为独立组件/文件承载 mode 和 Run 语义，Home 只保留入口职责
- 修复 Lynxtron GO 对 showcase / workspace 文件的 TypeScript diagnostics 假阳性，确保 IDE 波浪线与项目真实语义一致，而不是套用错误的 fallback tsconfig
- 清理 Lynxtron GO、showcases、packages 与 scripts 中可证明未引用的 dead code，并记录被保留的模糊候选

### 架构评估（2026-04-17）

结论：

- 当前工程**不需要仓库级别的重新梳理或重写**；monorepo 分层、`packages/cli` 的 thin launcher 方向、showcase 作为完整 Lynxtron app 的模型仍然成立
- 当前真正需要的是 **Lynxtron GO 的定向架构整治**，否则后续继续叠加 scheme、example artifact、更多 workspace/source mode 时，复杂度会持续堆在单点文件里

判断依据：

- `lynxtron-go/src/app/App.tsx` 已达 1600+ 行，混合了 route、workspace、editor、diagnostics、showcase/example 打开链路、运行态控制和 deep-link 应用逻辑
- `lynxtron-go/src/main/desktop/preload.ts` 已达 800+ 行，混合了 config、fs bridge、language service、PTY、showcase process 管理和 example artifact 运行能力
- route foundation 的产品设计已经要求 `workspace` 带 `source` 语义，但当前实际 `AppRoute` 仍只有 `rootPath/activeFile`，说明“导航模型”和“运行语义模型”仍然分散在多个状态源中

因此冻结以下产品决策：

- **不做** monorepo 级大重构，不调整 `packages / showcases / lynxtron-go` 的顶层架构
- **要做** 一轮受控的、可分步验收的 GO 架构整理，优先级高于继续叠加新的 GO 入口能力

定向整治范围：

- 提炼 `workspace session` / `workspace source mode` / `run target` 的统一领域模型，减少 `route`、`ideMode`、`rootPath`、`lastWorkspacePath` 等并行状态分叉
- 将 `App.tsx` 拆成 app-shell/navigation、workspace orchestration、editor/runtime integration 三层边界，避免继续把新流程堆回单文件
- 将 `preload.ts` 拆成明确 service 模块，至少区分 config/fs、language-service、terminal/process、showcase/example runtime 四类职责
- 维持现有 CLI 与 showcase 包结构，除非后续出现新的跨包耦合证据，否则不把重构面扩大到整个仓库

执行要求：

- 本轮整治必须按 workflow 拆成小任务逐步验收，不能以“停下来先重写一遍”为策略
- 文档变更之外的后续实现，应先从 `lynxtron-go` 开始，不扩散到 showcase 与 CLI

## 7. 成功标准

一个开发者打开 Lynxtron GO 后：
1. **10 秒内** 看到 showcase gallery，理解"这是什么"
2. **30 秒内** 点击 Benchmark，看到 58MB vs 161MB，滑动长列表感受流畅
3. **2 分钟内** 理解三个差异化价值（轻量 / 原生集成 / 跨端）
4. **5 分钟内** 决定是否值得深入了解

## 8. 非目标

- 不做移动端 showcase（仓库没有移动端环境，但叙事中提及移动端前景）
- 不做 Lynxtron GO 大重构
- 不做性能基准测试工具（只做视觉 demo）
- 不做文档网站

## 9. 开发规则

- 产品决策由主对话（PM 角色）做出，记录在此文档
- 具体实现任务 dispatch 给 subagent 执行
- 所有 showcase 遵循标准交付物模板
- 按 workflow 流程开发：plan → implement → verify → commit
- 提交粒度要可追溯：一个 commit 只覆盖一个能独立理解、独立审阅、独立回滚的产品能力、workflow 步骤或受限基础设施改动
- 共享基础设施改动应尽量和产品 UI / showcase 改动拆开提交，除非耦合过强导致拆分会降低可读性
- 新功能或 showcase 在 commit 之前必须完成该范围对应的 build / test / smoke 验证；如果验证被已知问题阻塞，不能把该任务按完成态提交，需先由 PM 明确放行
- 仅文档变更可以不做 runtime 验证，但 workflow 或提交说明必须明确写出“无 runtime 验证是有意为之”
- 禁止把 `node_modules`、build 产物、vendored 代码或生成物混入 commit，除非 PM 明确要求
- workflow 文档和状态更新必须记录“提交前验证了什么”，以及是否存在未解决的验证阻塞
