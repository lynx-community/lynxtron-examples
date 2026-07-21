# Showcase Design: Benchmark Dashboard

## Overview

展示 Lynxtron 自身的运行时数据——包大小、启动时间、内存占用。所有数据实时读取，不硬编码。

**Slogan**: Light-weight and fast
**UI 风格**: 深色科技感（Vercel/Linear 风格，暗色背景 + 亮色数据）

## UI Layout

```
┌──────────────────────────────────────────────────┐
│  LYNXTRON BENCHMARK                              │
│                                                  │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  APP SIZE    │ │ STARTUP  │ │   MEMORY     │  │
│  │              │ │          │ │              │  │
│  │  58 MB       │ │  142ms   │ │  47 MB       │  │
│  │  Runtime     │ │          │ │  RSS         │  │
│  │              │ │  Cold    │ │              │  │
│  └──────────────┘ │  Start   │ └──────────────┘  │
│                   └──────────┘                   │
│  ┌──────────────────────────────────────────────┐│
│  │  APP SIZE BREAKDOWN                          ││
│  │  ████████████████████████████████░░░░ 58 MB  ││
│  │  Runtime                                     ││
│  │  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  336 KB  ││
│  │  Business Code (Lynx bundle + host)          ││
│  │  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░  14 MB  ││
│  │  Native Extensions                           ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  Lynxtron v0.0.1-alpha.0 · darwin arm64          │
└──────────────────────────────────────────────────┘
```

## 三个数据模块

### Module 1: App Size

**数据来源**（preload 层）：
```typescript
benchmark: {
  getAppSize(): {
    runtime: number;      // lynxtron.app framework binary 大小 (bytes)
    business: number;     // dist/desktop/ 下的业务代码大小 (bytes)
    extensions: number;   // native extensions (.node + 源码) 大小 (bytes)
    total: number;        // runtime + business + extensions
  }
}
```

**实现方式**：
- Runtime: 读取 `lynxtron.app/Contents/Frameworks/Lynxtron Framework.framework/Versions/*/Lynxtron Framework` 的文件大小
- Business: 遍历 `dist/desktop/` 下的 `.js` + `.lynx.bundle` + `.json` 文件大小
- Extensions: 遍历 `dist/desktop/node_modules/` 下的 native extension 大小
- 通过 `require.resolve('@lynx-js/lynxtron')` 定位 runtime 路径

**UI 渲染**：
- 顶部卡片：总大小，大字体，带单位 "MB"
- 下方：堆叠水平条形图，三层（runtime / business / extensions），每层标注大小和名称
- 颜色：runtime 用主色（蓝），business 用绿，extensions 用橙

### Module 2: Startup Time

**数据来源**（preload + app 层）：
```typescript
benchmark: {
  getStartupTime(): {
    processStart: number;   // process.uptime() * 1000 在 preload 最早时刻记录
    firstFrame: number;     // app 组件 onMount 时的 Date.now() - 页面创建时间
  }
}
```

**实现方式**：
- 在 preload.ts 最顶部记录 `const preloadStart = Date.now()`
- 暴露 `benchmark.getStartupTime()` 返回 `Date.now() - preloadStart`（近似冷启动时间）
- App UI 组件 mount 时调用一次，显示结果

**UI 渲染**：
- 卡片：大字体显示毫秒数，如 "142ms"
- 副标题："Cold Start → First Frame"
- 颜色编码：< 200ms 绿色，200-500ms 黄色，> 500ms 红色

### Module 3: Memory Usage

**数据来源**（preload 层）：
```typescript
benchmark: {
  getMemoryUsage(): {
    rss: number;            // process.memoryUsage().rss (bytes)
    heapUsed: number;       // process.memoryUsage().heapUsed (bytes)
    heapTotal: number;      // process.memoryUsage().heapTotal (bytes)
  }
}
```

**实现方式**：
- preload 直接暴露 `process.memoryUsage()` 的数据
- App UI 层定时 poll（每 2 秒）刷新显示

**UI 渲染**：
- 卡片：RSS 大字体，如 "47 MB"
- 副标题："Resident Set Size"
- 下方小字：Heap Used / Heap Total

## 文件结构

```
showcases/benchmark/
  package.json
  lynx.config.ts              # 复用 @lynxtron-showcases/config
  rspack.config.ts            # desktop only
  README.md
  src/
    app/
      index.tsx               # 入口
      App.tsx                 # 主布局：三个卡片 + 条形图
      App.css                 # 深色主题样式
      components/
        MetricCard.tsx        # 通用数据卡片（大数字 + 标签 + 副标题）
        MetricCard.css
        SizeBreakdown.tsx     # 堆叠条形图
        SizeBreakdown.css
    main/
      desktop/
        main.ts               # 最小 LynxWindow host
        preload.ts             # benchmark API (getAppSize, getStartupTime, getMemoryUsage)
        vendorPaths.ts
```

## 验收标准

### 功能验收
1. `pnpm run build` 构建成功，产出 `dist/desktop/`
2. `lynxtron ./dist/desktop` 启动后显示三个数据卡片
3. App Size 卡片显示真实数字（不是 0 或 NaN），runtime ~58MB
4. Startup Time 显示合理毫秒数（100-500ms 范围）
5. Memory Usage 显示合理数字（30-100MB 范围），每 2 秒刷新
6. Size Breakdown 条形图三层都有数据，比例正确

### UI 验收
1. 深色背景（#0a0a0a 或类似）
2. 数据数字用大字体（32px+），白色
3. 标签用灰色小字
4. 条形图有颜色区分，鼠标悬停不需要（Lynx 无 hover）
5. 底部显示 Lynxtron 版本号 + 平台信息

### 集成验收
1. `showcase` metadata 在 package.json 中
2. `pnpm run generate-registry` 后出现在 registry
3. 在 Lynxtron GO 中可以通过 "Open Showcase" 打开
4. 可以通过 Cmd+R 在 Lynxtron GO 中运行

## 开发流程

1. Subagent 创建 workflow MD
2. Subagent 按 step 实现：scaffold → preload API → UI 组件 → 集成
3. 每个 step 需要满足验收标准中对应的条目
4. 最终验证：PM 运行 app 确认数据正确 + UI 符合设计
