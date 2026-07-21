# Showcase Design: Native Texture Canvas

## Overview

展示 Lynxtron 的原生组件嵌入能力——在同一个 app 内，Lynx UI 与多个 native view 无缝共存。

**Slogan**: Native extensible
**UI 风格**: 深色科技感，左侧导航切换不同 native view demo

## UI Layout

```
┌──────────────────────────────────────────────────┐
│  NATIVE TEXTURE CANVAS                                   │
│                                                  │
│  ┌────────┐ ┌───────────────────────────────────┐│
│  │        │ │                                   ││
│  │ Code   │ │  [Active Demo Area]               ││
│  │ Editor │ │                                   ││
│  │        │ │  Scintilla native editor          ││
│  │ Color  │ │  — or —                           ││
│  │ Picker │ │  Color picker with preview        ││
│  │        │ │  — or —                           ││
│  │ File   │ │  File preview panel               ││
│  │ Preview│ │  — or —                           ││
│  │        │ │  System info dashboard            ││
│  │ System │ │                                   ││
│  │ Info   │ │                                   ││
│  │        │ │                                   ││
│  └────────┘ └───────────────────────────────────┘│
│                                                  │
│  Each demo: Native View (C++) + Lynx UI controls │
└──────────────────────────────────────────────────┘
```

## 四个 Demo Tab

### Demo 1: Code Editor

**展示**：Scintilla native editor 嵌入 Lynx UI（已有能力复用）

**组成**：
- 上方：Lynx UI 工具栏（文件名、语言选择、字体大小控制）
- 中间：`<scintilla-view>` native view 渲染代码
- Lynx UI 控件实时控制 native editor 的行为（字体大小通过 NAPI 调用）

**数据来源**（preload）：
```typescript
// 已有 API，无需新增
scintillaApi().setText(id, text)
scintillaApi().getText(id)
scintillaApi().gotoLine(id, line)
```

### Demo 2: Color Picker

**展示**：调用 macOS 原生颜色选择器，选中颜色实时反映到 Lynx UI

**组成**：
- 左侧：Lynx UI 显示当前选中颜色（色块 + hex 值 + RGB 值）
- 右侧：Lynx UI 颜色历史记录列表
- 按钮：点击 "Pick Color" 调起 macOS NSColorPanel

**数据来源**（preload 新增）：
```typescript
native: {
  pickColor(): string  // 调用 NSColorPanel，返回 hex 颜色值 "#RRGGBB"
}
```

**实现方式**：
- preload 中用 Node.js 子进程调用 osascript（AppleScript）获取颜色选择器结果
- 或者写一个简单的 native extension 包装 NSColorPanel

### Demo 3: File Preview

**展示**：在 Lynx UI 中预览本地文件（图片/文本），展示 Node.js 文件系统 + Lynx 渲染的配合

**组成**：
- 上方：Lynx UI 文件选择器（调用 dialog.showOpenDialog）
- 中间：
  - 图片文件 → 读取为 base64，用 `<image>` 渲染
  - 文本文件 → 读取内容，用 `<text>` 渲染（代码高亮可选）
- 底部：文件元信息（大小、修改时间、类型）

**数据来源**（preload，复用已有 + 新增）：
```typescript
// 已有
fs.readFile(path)      // 文本
fs.readdir(dir)

// 新增
native: {
  readFileBase64(path: string): string  // 读取文件为 base64（图片用）
  getFileMeta(path: string): { size: number; mtime: string; type: string }
}
```

### Demo 4: System Info

**展示**：Node.js 系统 API + Lynx UI 仪表盘的配合

**组成**：
- CPU：型号、核心数、使用率（poll 刷新）
- Memory：总量、已用、可用（条形图）
- OS：系统版本、主机名、uptime
- Lynxtron：runtime 版本、Node.js 版本、Lynx SDK 版本

**数据来源**（preload 新增）：
```typescript
native: {
  getSystemInfo(): {
    cpu: { model: string; cores: number }
    memory: { total: number; free: number }
    os: { platform: string; version: string; hostname: string; uptime: number }
    runtime: { lynxtron: string; node: string; lynxSdk: string }
  }
  getCpuUsage(): number  // 0-100 百分比
}
```

**实现方式**：Node.js `os` 模块直接获取

## 文件结构

```
showcases/native-texture-canvas/
  package.json
  lynx.config.ts
  rspack.config.ts
  README.md
  src/
    app/
      index.tsx
      App.tsx                  # 左侧导航 + 右侧 demo area
      App.css
      components/
        NavBar.tsx             # 左侧 tab 导航
        NavBar.css
        CodeEditorDemo.tsx     # Demo 1
        ColorPickerDemo.tsx    # Demo 2
        FilePreviewDemo.tsx    # Demo 3
        SystemInfoDemo.tsx     # Demo 4
    main/
      desktop/
        main.ts
        preload.ts             # native API (pickColor, readFileBase64, getSystemInfo, etc.)
        vendorPaths.ts
  extension/                   # 如果需要 native color picker extension
  scintilla-extension/         # 或者 symlink 到 lynxtron-go 的
```

## 验收标准

### 功能验收
1. `pnpm run build` 构建成功
2. 启动后显示 4 个 tab，每个 tab 可切换
3. Code Editor tab：能编辑代码，Lynx 工具栏能控制字体大小
4. Color Picker tab：点击按钮弹出系统颜色选择器，选色后 Lynx UI 更新
5. File Preview tab：能选择文件，图片显示为图片，文本显示为文本
6. System Info tab：显示真实系统信息，CPU 使用率每 2 秒刷新

### UI 验收
1. 深色主题一致
2. 左侧导航高亮当前 tab
3. 每个 demo 有标题说明"这展示了什么"
4. native view 和 Lynx UI 视觉融合，没有明显割裂

### 集成验收
1. showcase metadata 在 package.json
2. 出现在 Lynxtron GO showcase 列表
3. 可通过 Lynxtron GO 运行

## 依赖说明

- Scintilla extension：复用 lynxtron-go 的，或者 symlink
- 颜色选择器：如果 osascript 方案不够稳定，需要写一个轻量 native extension
- 其他都是 Node.js 标准 API，无额外依赖

## 开发流程

1. 先做 Demo 4 (System Info) — 最简单，纯 Node.js
2. 再做 Demo 3 (File Preview) — 复用已有 fs API
3. 再做 Demo 2 (Color Picker) — 可能需要 native 调用
4. 最后做 Demo 1 (Code Editor) — 复用 Scintilla，但需要处理 extension 依赖
