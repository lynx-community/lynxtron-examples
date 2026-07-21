# Showcase Design: Cross-Platform Notes

## Overview

一个 Markdown 笔记应用，同一份 Lynx UI 代码跑桌面和浏览器，证明 UI 代码的跨端可移植性。

**Slogan**: Cross platforms
**UI 风格**: 深色科技感，简洁双栏布局
**核心信息**: "This app's UI code runs on Desktop (Lynxtron), Web (Browser), and Mobile (Lynx iOS/Android) — same code, native rendering on every platform."
**MVP 范围**: 左侧笔记列表 + 右侧 Markdown 文本编辑 + 底部平台信息栏，不做富预览渲染

## UI Layout

```
┌──────────────────────────────────────────────────┐
│  CROSS-PLATFORM NOTES                            │
│                                                  │
│  ┌──────────┐ ┌─────────────────────────────────┐│
│  │          │ │                                 ││
│  │ Note 1   │ │  # Markdown Title               ││
│  │ Note 2 ● │ │                                 ││
│  │ Note 3   │ │  This is **bold** and *italic*  ││
│  │          │ │                                 ││
│  │          │ │  - List item 1                  ││
│  │          │ │  - List item 2                  ││
│  │          │ │                                 ││
│  │          │ │  ```code block```               ││
│  │          │ │                                 ││
│  │  [+ New] │ │                                 ││
│  └──────────┘ └─────────────────────────────────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │ 🖥 Desktop (Lynxtron) · v0.0.1 · darwin     ││
│  │ Same UI code → Desktop + Web + Mobile        ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

## 功能模块

### Module 1: 笔记列表（左栏）

- 显示所有笔记标题
- 当前选中笔记高亮
- "+" 按钮创建新笔记
- 长按/右键可删除（或滑动删除）

### Module 2: 编辑器（右栏）

- 纯文本 Markdown 编辑（`<input>` 多行或 `<textarea>` 等效）
- 实时编辑 markdown 源码，不做富渲染预览
- 自动保存（debounce 500ms）

### Module 3: 平台信息栏（底部）

- 显示当前平台：Desktop (Lynxtron) / Web (Browser)
- 显示版本号
- 提示信息："Same UI code → Desktop + Web + Mobile"

## 数据存储

**Symmetric Host Model** — 桌面和 Web 使用不同存储实现，但 UI 层 API 统一：

```typescript
// UI 层统一调用接口（通过 NativeModules）
interface NotesStorage {
  list(): Array<{ id: string; title: string; updatedAt: string }>
  get(id: string): { id: string; title: string; content: string }
  save(id: string, title: string, content: string): void
  create(): { id: string }
  remove(id: string): void
}

// Desktop 实现（preload.ts）：文件系统
//   ~/.lynxtron-notes/ 目录下每个笔记一个 .md 文件

// Web 实现（nodejs_adapter_web.ts）：localStorage
//   JSON 序列化存储
```

## 跨端实现

### lynx.config.ts

```typescript
// 双环境：lynx (desktop) + web (browser)
export default createShowcaseConfig({
  entry: './src/app/index.tsx',
  web: true,  // 启用 web environment
});
```

### rspack.config.ts

双 target 配置（参考 shell-demo）：
- Desktop: `target: 'electron-main'`，入口 `src/main/desktop/main.ts`
- Web: `target: 'web'`，入口 `src/main/web/web-host.ts`

### 目录结构

```
showcases/cross-platform-notes/
  package.json
  lynx.config.ts                # 双环境 (lynx + web)
  rspack.config.ts              # 双 target (desktop + web)
  README.md
  src/
    app/                        # 跨端共享 UI（核心价值所在）
      index.tsx
      App.tsx                   # 双栏布局
      App.css
      components/
        NoteList.tsx            # 左栏笔记列表
        NoteList.css
        NoteEditor.tsx          # 右栏编辑器
        NoteEditor.css
        PlatformInfo.tsx        # 底部平台信息栏
        PlatformInfo.css
    main/
      desktop/                  # 桌面 host
        main.ts                 # LynxWindow
        preload.ts              # notes storage via filesystem
        vendorPaths.ts
      web/                      # Web host
        web-host.ts             # setupSymmetricHost
        nodejs_adapter_web.ts   # notes storage via localStorage
        index.html
  dist/
    desktop/                    # npm start 产物
    web/                        # npm run start:web 产物
```

### scripts

```json
{
  "scripts": {
    "build": "rspeedy build && rspack build",
    "start": "cross-env TARGET_ENV=desktop npm run build && lynxtron ./dist/desktop",
    "start:web": "cross-env TARGET_ENV=web npm run build && npx serve ./dist/web",
    "dev": "cross-env TARGET_ENV=desktop NODE_ENV=development concurrently -k --raw \"rspeedy dev\" \"dev-ready-rspeedy && rspack dev\"",
    "dev:web": "cross-env TARGET_ENV=web NODE_ENV=development concurrently -k --raw \"rspeedy dev\" \"rspack serve\""
  }
}
```

## 验收标准

### 功能验收 — Desktop
1. `npm start` 打开桌面窗口
2. 左栏显示笔记列表（初始有 1 个示例笔记）
3. 点击笔记 → 右栏显示内容
4. 编辑内容 → 自动保存到 `~/.lynxtron-notes/`
5. "+" 创建新笔记
6. 底部显示 "Desktop (Lynxtron)"

### 功能验收 — Web
1. `npm run start:web` 打开浏览器
2. 同样的 UI 布局和交互
3. 数据保存到 localStorage
4. 底部显示 "Web (Browser)"

### 跨端一致性验收
1. 桌面和 Web 的 UI 布局完全一致（可截图对比）
2. 操作流程一致：列表 → 选中 → 编辑 → 保存 → 创建
3. 唯一差异：底部平台信息栏显示不同平台名 + 存储方式不同

### UI 验收
1. 深色主题一致
2. 编辑器文本清晰可读
3. 笔记列表当前选中有高亮
4. 底部平台信息栏有明显的跨端提示文案

### 集成验收
1. showcase metadata 在 package.json
2. 出现在 Lynxtron GO showcase 列表
3. 可通过 Lynxtron GO 运行（桌面版）

## 开发流程

1. 先做 scaffold（双 target 配置能构建通过）
2. 再做共享 UI shell（左栏列表、右栏编辑器、底部平台信息栏）
3. 再做桌面版存储 + Web 存储适配
4. 最后做自动保存、截图对比和 registry 接入验证
