# Lynxtron IDE Plan

## 愿景 (Vision)
构建一个基于 Lynxtron 的高性能、模块化、可扩展的现代集成开发环境 (IDE)。核心编辑器采用 **Scintilla** (C++) 提供原生性能，上层通过 **ReactLynx** 构建 UI，底层通过 **Node.js** 提供丰富的插件生态系统。

该 IDE 将以 `package.json` 为核心管理项目，并设计一套完善的插件机制以支持多语言开发和功能扩展。

## 架构设计 (Architecture)

### 1. 核心层 (Core Layer)
- **Shell (Lynxtron Main Process)**: 负责应用生命周期、窗口管理、原生菜单、系统级集成。
- **UI (Renderer Process)**: 使用 ReactLynx 构建，负责界面渲染、布局系统、交互逻辑。
- **Editor Engine**: 集成 **Scintilla** (v5.x+)，通过 N-API Binding 暴露给 ReactLynx。React 组件调用 `NativeModules` 接口（如 `setText`）直接操作底层的 Scintilla View。

### 2. 扩展层 (Extension Layer)
为了保证主线程（UI）的流畅性，扩展将在独立的 **Extension Host** 进程中运行。
- **Extension Host**: 一个独立的 Node.js 进程，负责加载插件、执行插件代码、管理插件生命周期。
- **API Surface**: 提供一套 VS Code 风格的 API (`lynxtron.window`, `lynxtron.workspace`, `lynxtron.languages`, etc.)。
- **Inter-Process Communication (IPC)**: UI 与 Extension Host 之间通过高效的 RPC 通信。

### 3. 插件系统 (Plugin System)
插件是 IDE 的一等公民。每个插件也是一个 NPM 包，通过 `package.json` 描述元数据和贡献点。

#### 插件结构 (`package.json`)
```json
{
  "name": "my-extension",
  "engines": { "lynxtron": "^1.0.0" },
  "activationEvents": [
    "onLanguage:typescript",
    "onCommand:extension.helloWorld"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [...],
    "menus": {...},
    "keybindings": [...],
    "languages": [...],
    "themes": [...]
  }
}
```

## 功能路线图 (Feature Roadmap)

### Phase 1: 基础架构与 Scintilla 集成 ✅ 基本完成
- [x] **Project Setup**: 工程搭建 (React + Rspack + Lynxtron)。
- [x] **Native Extension**: N-API 基础架构（`setText`, `getText`, `setStyles`, `captureWindow`, `captureWindowToBase64`）。
  - *`scintilla-extension/` 为当前保留的 Scintilla C++ 扩展实现。*
- [x] **Editor Core**: Scintilla 5.x 静态库编译与链接，嵌入为原生 NSView。
- [x] **Basic Editing**: 文本渲染、输入、VS Code Dark+ 主题。
- [x] **Syntax Highlighting**: 使用 **Prism.js** 词法分析，支持 JS/TS/CSS/JSON/Python/C++/ObjC++/Markdown。
  - ✅ *Prism.js 替换原有手写状态机，精度大幅提升。*
  - ✅ *修复了两个底层 Bug：`[NSApp keyWindow]` 返回 nil 导致 NSView 不加入 window；Registry 无 pending styles 导致 setStyles 失败。*
  - ✅ *ApplyStyles 增加 `setNeedsDisplay:YES` 确保样式变更触发重绘。*
- [ ] **Extension Architecture**: 插件加载机制（设计阶段，未实现）。

### Phase 1.5: IDE Shell UI ✅ 基本完成（已 MCP 验证）
- [x] **File Explorer**: 侧边栏目录树，支持展开/折叠子目录，文件图标。
  - ✅ *MCP 验证：文件树显示正常，`readdirStat` 正常返回 28 个条目。*
- [x] **Open Folder**: `⊕` 按钮 + `⌘⇧O` 菜单快捷键，调用系统文件夹对话框。
  - ✅ *MCP 验证：按钮 tap 正常触发，bridge call 正常，native dialog 正常打开。*
- [x] **Persistent Workspace**: 记忆上次打开的文件夹路径，重启后自动恢复。
  - 存储于 `~/.lynxtron-ide.json`，preload.ts 提供 `config.get/set` API。
  - ✅ *MCP 验证：重启后自动 restore，status bar 显示"Opened lynxtron-ide-mvp"。*
- [x] **Tab Bar**: 多文件标签，切换/关闭，脏状态标记（`●`）。
- [x] **File Open**: 点击侧边栏文件打开到编辑器，标签去重复用。
- [x] **Save File**: `⌘S` 保存，写回磁盘，清除脏标记。
- [x] **Status Bar**: 语言检测、保存按钮、状态消息。
- [x] **App Menu**: File / Edit / View 菜单及标准快捷键。
  - ✅ *修复 NSMenuItem keyEquivalent 大小写 bug：`KeyEquivalentFromAccelerator()` 返回大写字母导致 macOS 匹配 Cmd+Shift+X。修复：`base::ToLowerASCII(key)`（分支 `fix/mac-menu-key-equivalent`）。*
  - ✅ *Open Folder (`⌘⇧O`) 延迟优化：菜单 click handler 直接调用 `dialog.showOpenDialog()`，省去 Lynx UI → bridge → main 的 2 次 IPC 往返。*
- [x] **Quick File Picker**: `⌘P` 触发，输入过滤，点击打开（待手动测试）。
- [x] **Window Screenshot**: `captureWindow` + `captureWindowToBase64` API，含原生 NSView 层。

### Lynx SDK 修复（上游贡献）
- [x] **GlobalEventEmitter.emit() apply 兼容性**: `emit()` 使用 `listener.apply(ctx, data)`，要求 `data` 必须是数组。embedder 路径的 `SendGlobalEvent` 传入的是 JSON parse 后的普通对象，导致 listener 参数为 undefined。
  - ✅ *修复：`const args = Array.isArray(data) ? data : [data]`，兼容数组和非数组 data（分支 `fix/global-event-emitter-apply-non-array`，lynx SDK repo）。*
  - ✅ *不影响 Android/iOS 现有行为（已是数组的路径走原逻辑）。*

### Phase 1.8: 可定制布局系统（Layout Architecture）
- [x] **Phase A — SplitContainer + Sash**: 可拖动分隔条调整 sidebar/editor 宽度。
  - ✅ *SplitContainer 二叉分割容器，支持 horizontal/vertical 方向。*
  - ✅ *Sash 拖动手势：同时绑定 `bindmousedown/move/up`（桌面）和 `bindtouchstart/move/end`（移动端）。*
  - ✅ *全屏透明 overlay 防止鼠标快速移动时逃逸 4px 宽的 Sash 元素。*
  - ✅ *架构设计文档：`docs/LAYOUT_ARCHITECTURE.md`。*
- [x] **Phase B — PanelRegistry + ActivityBar**: 面板注册表 + 左侧图标导航条。
  - ✅ *PanelRegistry：中央注册表管理 sidebar 面板（explorer/search/debug）。*
  - ✅ *ActivityBar：48px 图标条，点击切换 sidebar 面板，白色左边框指示当前面板。*
  - ✅ *SearchPanel 占位面板，为全局搜索功能预留。*
  - ✅ *MCP 验证：Activity Bar 渲染正常，面板切换 Explorer↔Search 通过。*
- [x] **Phase C — BottomPanel 可切换面板区域**: 底部面板（Terminal/Output/Problems）+ `⌘J` 切换。
  - ✅ *BottomPanel 组件：tab bar 切换 Terminal/Output/Problems，✕ 关闭按钮。*
  - ✅ *PanelRegistry 扩展：注册 terminal/output/problems 为 `bottom` 位置面板。*
  - ✅ *App.tsx 集成：`bottomPanelOpen` 状态 + vertical SplitContainer 包裹 Editor + BottomPanel。*
  - ✅ *View 菜单 Toggle Panel (`⌘J`) 快捷键，通过 `ide:togglePanel` 全局事件触发。*
  - ✅ *修复：SplitContainer `collapsed` prop 让 EditorPanel 始终挂载，防止 Scintilla NSView 在切换时崩溃。*
  - ✅ *修复：`EditorArea` flex:1 包裹层修正垂直布局高度（SplitContainer `height:100%` 在 flex-col 中会溢出 StatusBar）。*
  - ✅ *修复：SplitPane 加 `display:flex; flex-direction:column` 使子组件 `flex:1`/`height:100%` 生效。*
- [x] **Phase D — 布局持久化**: 重启恢复 sash ratio + panel 状态。
  - ✅ *4 个持久化键：`layout.sidebarRatio`、`layout.editorBottomRatio`、`layout.bottomPanelOpen`、`layout.sidebarPanel`。*
  - ✅ *lazy `useState` 初始化从 config 读取；ratio 变化 300ms debounce 写入；panel 开关同步写入。*
- [x] **Integrated Terminal**: BottomPanel Terminal tab 集成真实 shell。
  - ✅ *Preload PTY API：`pty.create/write/read/kill/isAlive/cd`，spawn login shell，pipe stdin/stdout/stderr，ANSI 转义清洗。*
  - ✅ *TerminalPanel 组件：滚动输出区 + 底部命令输入行 + 实时 100ms 轮询。*
  - ✅ *打开 folder 后 terminal 自动 cd 到 workspace 目录。*

### Phase 2: 增强编辑器与语言服务
- [x] **Real-time Syntax Highlighting**: 编辑时实时更新语法高亮（Phase 2a）。
  - ✅ *轮询 `getText()` 100ms，debounce 50ms，感知延迟 ~150ms。*
  - ✅ *移除 `ApplyStyles` 中多余的 `setNeedsDisplay:YES`，消除了打字时的全视图扫描闪白。*
  - ✅ *详细架构设计见 `docs/LANGUAGE_SERVICES_ARCHITECTURE.md`（含 LSP、诊断、补全等完整路线图）。*
- [x] **SCN_MODIFIED Callback** (Phase 2b): C++ 回调替代轮询，延迟降至 <50ms。
  - ✅ *`ScintillaViewContainer` 实现 `ScintillaNotificationProtocol`，`-notification:` 在 SCN_MODIFIED 时设 `atomic<bool>` 脏标记。*
  - ✅ *JS 轮询改为 `hasContentChanged()`（仅读 atomic bool，零 string copy），有变化才调 `getText()`。*
- [ ] **Editor Features**:
    - 光标行列号显示（需新增 Scintilla C++ API `getCaretPosition`）。
    - 查找与替换 (Find & Replace)。
    - 撤销/重做（Scintilla 内置，需暴露快捷键绑定）。
- [ ] **File Explorer 增强**:
    - 新建/删除/重命名文件（需 Node.js `fs` API 扩展）。
    - 全局内容搜索。
- [ ] **Plugin API MVP**: vscode 风格 API 设计与实现。

### Phase 3: 语言服务与诊断（Language Services）
- [x] **Extension Host**: 独立 Node.js 子进程，在 `preload.ts` 中 fork，通过 BTS 桥接。
  - ✅ *TypeScript Compiler API — TS/TSX/JS/JSX 语法 + 语义诊断。*
  - ✅ *vscode-css-languageservice — CSS/SCSS/Less 诊断（⚠️ 受 small-icu 限制，extension host 可能崩溃）。*
  - ✅ *Preload 缓存最新诊断结果，Renderer 100ms 轮询取结果（代替全局事件推送）。*
- [x] **Scintilla Indicator API**: C++ `SetIndicators / ClearIndicators`，三级波浪线（红/黄/蓝）。
  - ✅ *N-API `setIndicators(editorId, ArrayBuffer)` — packed int32 triplets。*
  - ✅ *`cmake --build` 编译验证通过。*
- [x] **Position Conversion**: LSP line/char (UTF-16) → Scintilla UTF-8 字节偏移。
  - ✅ *`diagnostics.ts`: `lineCharToByteOffset` + `markerToIndicator` + `packIndicators`，17 个单元测试覆盖。*
- [ ] **E2E 验证**: 在 IDE 中打开 TS 文件，确认波浪线正常显示。（❗待验证）
- [ ] **ICU Error 修复**: vscode-css-languageservice 在 small-icu 环境下崩溃，需处理。

### Phase 3.5: 文件系统增强
- [ ] **FileSystem Provider**: 抽象文件系统访问，支持本地和远程文件。
- [ ] **Search**: 全局文件搜索与内容搜索 (Ripgrep 集成)。

### Phase 4: 语言智能进阶 (LSP)
- [ ] **Hover / Completion**: 悬浮提示、自动补全（需 Scintilla autocomplete API）。
- [ ] **Go to Definition / Find References**: 基于 TypeScript LanguageService。
- [ ] **Python / C++ 支持**: pyright / clangd stdio LSP 接入（Phase 3 预留接口）。

### Phase 5: 调试与终端 (DAP & Terminal)
- [ ] **Debug Adapter Protocol (DAP)**: 支持断点调试。
- [x] **Integrated Terminal**: poll-based PTY，login shell，stdin/stdout 管道，已集成到 BottomPanel Terminal tab。（MVP，不含 xterm.js ANSI 渲染）

## 技术选型 (Tech Stack)
- **Runtime**: Lynxtron (Electron-like), Node.js
- **UI Framework**: ReactLynx, CSS (Flexbox)
- **Editor Engine**: Scintilla (C++)
- **Build System**: Rspack, RSpeedy, CMake
- **Language**: TypeScript (Frontend/Extension), C++/Objective-C (Native Core)
