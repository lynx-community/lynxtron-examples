# Debug Strategy

## 概述
为了确保 Lynxtron IDE 的稳定性与可维护性，我们建立多层次的调试策略，覆盖渲染层、主进程、扩展主机及原生模块。

## 1. 渲染层调试 (Renderer Debugging)
Lynx 使用自定义的渲染引擎，其调试方式与标准 Web 不同。我们主要依赖 MCP (Model Context Protocol) 提供的工具进行交互式调试。

### 工具
- **Lynx DevTool MCP Server**: 提供了一系列工具来检查运行时状态。
  - `Device_listClients`: 列出连接的设备。
  - `Device_listSessions`: 列出调试会话。
  - `DOM_getDocument`: 获取当前页面的 DOM 树。
  - `DOM_getAttributes`: 查看节点属性。
  - `Runtime_listConsole`: 获取控制台日志。
  - `CSS_getComputedStyleForNode`: 查看节点样式。
  - `Input_emulateTouchFromMouseEvent`: 模拟点击事件。
  - `Page_takeScreenshot`: 截取当前页面截图。

### 方法
- **启动调试**: 运行 `npm run debug:detached` 启动应用（`npm run dev` 仅启动开发服务器）。
- **连接**: 使用 MCP Client (如 Trae) 调用 `Device_listClients` 获取 `clientId`，然后调用 `Device_listSessions` 获取 `sessionId`。
- **调试**:
  - **查看 UI**: 调用 `DOM_getDocument` 获取 UI 结构。
  - **查看日志**: 调用 `Runtime_listConsole` 获取运行日志。
  - **检查元素**: 使用 `DOM_getAttributes` 和 `CSS_getComputedStyleForNode`。
  - **模拟交互**: 调用 `Input_emulateTouchFromMouseEvent` 触发点击事件。
  - **截屏**: 调用 `Page_takeScreenshot` 获取当前页面截图。
    > ⚠️ **已知限制**: `Page_takeScreenshot` 只捕获 Lynx Skia 渲染层，**不包含** Scintilla 原生 NSView 的内容。

### 截图策略

Lynx DevTool 的 `Page_takeScreenshot` 只能捕获 Lynx Skia 渲染层（UI 骨架），**不包含** Scintilla 原生 NSView 的内容。

> ⚠️ **编辑区黑色 ≠ 功能异常**
> 截图中编辑区域呈黑色是**正常现象**，仅表示 Scintilla NSView 内容超出了 DevTool 截图能力范围，并不代表编辑器功能故障。
>
> **快速判断编辑器是否正常工作：**
> 1. **状态栏**：检查底部状态栏是否显示文件名（如 `Markdown AGENTS.md ✓ Saved`）
> 2. **Tab 栏**：检查顶部是否有文件 Tab 且高亮
> 3. **`debug_terminal.log`**：检查 `OnLayoutChanged` 最新一条的 `width` / `height` 是否 > 0（为 0 表示视图还未布局完成）
> 4. **完整截图**：通过 `__ide_captureToFile()` 获取含 NSView 的合成截图

#### 推荐截图方案（AI 助手 / Claude Code）

**Step 1 — 截 Lynx UI 层**（侧边栏、Tab、状态栏）：
```
MCP: Page_takeScreenshot(clientId, sessionId)
```

**Step 2 — 截含原生编辑器的完整视图**：

在 App.tsx 中已在 `globalThis` 上暴露两个辅助函数，通过 `Input_emulateTouchFromMouseEvent` 点击触发，或在 DevTool 控制台（若可用）直接调用：

```js
// 保存到文件，再用 Read tool 读取
__ide_captureToFile()    // → /tmp/ide_screenshot.png

// 获取 base64 字符串（直接展示）
__ide_captureScreenshot()
```

底层使用 `scintillaApi().captureWindowToBase64()` → C++ 层通过 `screencapture -l WINDOW_ID` 从 window server compositor 合成截图，包含所有 native NSView 层。

> ⚠️ **不推荐**直接使用 `screencapture -x` Bash 命令——它会截整个屏幕，不精确且受权限限制。

#### 坐标系不一致问题（已验证）

MCP 工具间存在坐标系差异，**必须注意**：

| 工具 | 坐标系 | 说明 |
|---|---|---|
| `DOM_getBoxModel` | **物理像素**（2x DPR） | 返回实际渲染像素坐标 |
| `DOM_getNodeForLocation` | **物理像素**（2x DPR） | 与 box model 一致 |
| `Input_emulateTouchFromMouseEvent` | **逻辑像素**（÷2） | C++ 内部乘以 DPR=2 |

**经验法则**：
```
Input 坐标 = DOM_getBoxModel 坐标 ÷ 2
```

**验证**：
- ⊕ 按钮 box model 中心：(219, 17)
- `Input(219, 17)` → **不触发**
- `Input(109, 8)` = (219÷2, 17÷2) → **触发** openFolderDialog ✓
- `package.json` box model 中心：(119, 509)
- `Input(60, 254)` = (119÷2, 509÷2) → **触发** openFile ✓

#### MCP sessionId 类型问题（已修复）

MCP 工具要求 `sessionId` 为 number，但 Claude Code 工具调用参数始终以 string 传入。
**修复**：已对 `@lynx-js/devtool-mcp-server` 缓存文件打补丁，将 `schema_sessionId` 改为 `numberType({ coerce: true })`：

```
~/.npm/_npx/742c666cdf462163/node_modules/@lynx-js/devtool-mcp-server/dist/index.js
# 修改：const schema_sessionId = numberType({ coerce: true }).describe(...)
```

每次 MCP 服务器重新安装后需重新 patch。长期方案：向 `@lynx-js/devtool-mcp-server` 上游提 PR。

## 2. 主进程调试 (Main Process Debugging)
主进程运行在 Node.js 环境中，负责窗口管理与系统交互。

### 工具
- **Node.js Inspector**: V8 提供的调试协议。
- **VS Code Debugger**: 通过 `.vscode/launch.json` 配置 Attach。

### 方法
- **启动参数**: 使用 `--inspect` 或 `--inspect-brk` 启动 Lynxtron。
    ```bash
    npm run debug:detached
    ```
    **注意**: 
    1. Lynxtron 必须在**新的独立进程**中启动。如果作为子进程启动（例如某些 IDE 或构建工具的子任务），可能会导致崩溃。
    2. **TTY 依赖**: Lynxtron 的底层日志或某些 Native 模块（如 Scintilla）可能强依赖于 TTY（终端）环境。如果在没有 TTY 的 detached 模式下运行（且重定向了 stdio 到文件），可能会导致 SIGSEGV 崩溃。
    3. **推荐做法**: 
       我们提供了 `npm run debug:detached` 命令，它会通过 `scripts/start_debug.js` 生成一个临时 shell 脚本，并使用 macOS 的 `open -a Terminal` 命令在一个**新的终端窗口**中启动应用。这既保证了进程独立性，又保证了 TTY 环境的存在，能有效避免崩溃。
    4. 启动后，在 Chrome 中打开 `chrome://inspect`，点击 Configure 添加 `localhost:9222`，即可连接调试 Main 进程。
- **日志**: 使用 `console.log` 输出到终端。

## 3. 原生模块调试 (Native Module Debugging)
Scintilla 编辑器核心及其他 C++ 扩展的调试。

### 工具
- **LLDB**: macOS/Linux 下的标准调试器。
- **Console.app**: macOS 系统日志查看器。
- **File Logging**: 自定义文件日志 (当前已实现)。

### 方法
- **Attach to Process**: 使用 LLDB 附加到运行中的 Lynxtron 进程。
    ```bash
    lldb -p <pid>
    ```
- **Crash Reports**: 分析生成的 Core Dump 或 Crash Report。
- **File Logging (推荐)**:
    - 机制：在 C++ 层写入 `/tmp/lynxtron_debug.log`。
    - 优势：不依赖调试器，不阻塞进程，持久化。
    - 使用：`NativeModules.nodejs.exposed.utils.log("message")`。

## 4. 插件调试 (Extension Debugging)
针对未来运行在 Extension Host 中的插件。（目前 Extension Host 尚处于设计阶段，以下为规划内容）

### 工具
- **Inspector Protocol**: 每个插件宿主进程都应暴露调试端口。
- **Debug Console**: IDE 内部提供的调试控制台。

### 策略
- **隔离**: 插件崩溃不应导致整个 IDE 崩溃。
- **监控**: 监控插件的 CPU 和内存使用情况。

## 5. AI 辅助调试 (AI-Assisted Debugging)
利用 MCP (Model Context Protocol) 增强调试能力。

- **上下文获取**: AI 可通过 MCP Server 读取当前打开的文件、项目结构、错误日志。
- **代码分析**: AI 可直接读取源码进行静态分析。
- **运行时检查**: 配合 Lynx DevTool MCP，AI 可“看到”运行时的界面结构。

## 调试清单 (Debug Checklist)
- [ ] 确保 `npm run dev` 能够正常启动并附加 DevTool。
- [ ] 确保原生模块编译时包含调试符号 (Debug Build)。
- [ ] 确保 `/tmp/lynxtron_debug.log` 有写入权限且格式清晰。
- [ ] 遇到崩溃 (SIGSEGV) 时，优先检查 C++ 指针操作与线程安全 (Main Thread vs JS Thread)。

## 6. 核心事件机制与坐标映射 (Core Event Mechanism & Coordinate Mapping)
在修复 Touch 事件与点击失效问题时，我们发现了以下关键机制：

### 坐标映射 (Coordinate Mapping)
Lynx 引擎内部使用逻辑像素 (Logical Pixels)，而原生事件通常包含物理像素 (Physical Pixels) 或设备独立像素 (DIP)。
在 Lynxtron 中，我们需要确保传递给 Lynx 引擎的坐标经过了正确的 **Device Pixel Ratio (DPR)** 转换。

- **Input**: 模拟事件通常传入逻辑坐标 (Logical Coordinates)。
- **Conversion**:
  ```cpp
  float dpr = view->GetDevicePixelRatio();
  // 兜底策略：如果获取的 DPR 异常小，假定为 Retina 屏幕 (2.0)
  if (dpr < 1.1f) dpr = 2.0f; 
  float final_x = x * dpr;
  float final_y = y * dpr;
  ```

### 命中测试与 Tag 获取 (Hit-Testing & Tag Resolution)
Lynx 的事件分发机制强依赖于目标元素的 `tag` (frontend_node_id)。
如果发送 `SendTouchEvent` 时 `tag` 为 0 或无效，`GenerateResponseChain` 可能返回空，导致事件被忽略（例如 `bindtap` 不触发）。

**解决方案**:
在发送事件前，必须先进行命中测试 (Hit-Testing) 获取正确的 `tag`。

1. **C++ API 扩展**:
   我们在 `lynx_view` 层暴露了 `GetNodeForLocation` 接口，透传至 `LynxTemplateRenderer`。
   ```cpp
   // lynx_view.h
   int32_t GetNodeForLocation(float x, float y);
   ```

2. **事件模拟流程**:
   在 `EventSimulationProxyImpl::EmulateTouch` 中：
   1. 接收输入坐标 (x, y)。
   2. 应用 DPR 转换为 (final_x, final_y)。
   3. 调用 `GetNodeForLocation(final_x, final_y)` 获取 `tag`。
   4. 将 `tag` 传入 `SendTouchEvent` (touchstart, touchmove, touchend)。

**验证**:
查看日志 `debug_terminal.log`，确认 `HandleTouchEvent` 的 `tag` 不为 0，且后续触发了 `SendPageEvent` (如 `tap` 事件)。
