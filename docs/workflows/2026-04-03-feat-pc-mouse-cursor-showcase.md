# Feature: PC Mouse / Cursor Showcase
- Branch: feat/monorepo-architecture
- Created: 2026-04-03
- Status: in_progress

## Goal

新增一个非常轻量、截图友好的 showcase，用于博客展示 Lynx 在 PC 端的鼠标与光标能力。

## Product Definition

该 showcase 必须满足：

- **简单**
  - 不做复杂业务流程
  - 不做重状态管理
  - 不做花哨动画
  - 保持单 block 主体，不扩成多面板或多 tile 对照页
- **突出重点**
  - 直接展示 drag / drop / pointer / cursor 等 PC 特性
  - 一眼能看懂“这不是纯移动端交互”
- **截图友好**
  - 主视图构图清晰
  - 一张图能说明能力
  - 元素间距、层次、光标反馈都明显
  - 不保留持续跳动的调试信息或实时变化的大段文案

当前视觉与交互基线：

- 参考 `lynx-examples/hello-world` 的海报式单屏构图
  - 中心主体明确
  - 背景允许有简单的大形状/渐变氛围
  - 层级保持极简，不做复杂业务信息块
- 如果使用资产，优先使用一个轻量矢量/SVG 风格的视觉元素
  - 目的不是展示素材库，而是增强截图识别度
- 主文案应静态、简短
  - 去掉“实时变化坐标大数字”这类会干扰截图阅读的内容
  - 不保留调试文本或复杂状态信息
- 交互故事更新为：
  - 左侧一个可拖动的 Lynx Logo SVG
  - 右侧一个抽象的 Desktop SVG 桌面容器
  - 用户将 Lynx Logo 拖到 Desktop 中
- 构图额外要求：
  - draggable source 必须是 banner 形状的长方形，而不是接近正方形的卡片
  - drag source 和 drop target 都必须完整落在主画面可见区域内
  - 不接受 drop target 被画面裁掉、压到边界、或需要脑补可视范围
- Drop 成功后的结果：
  - Logo 停在 Desktop 中央即可
  - 不增加额外说明文案
- Cursor 语义更新为：
  - 可抓取时使用 `grab`
  - 拖动中使用 `grabbing`

建议内容：

1. 一个单屏主画面
   - 左侧 Lynx Logo SVG
   - 右侧 Desktop SVG
   - 中间留出足够拖拽路径

2. 一个极简说明区
   - 只需一行静态提示，例如 drag/drop 语义
   - 文案总量应明显少于当前版本

## Acceptance Target

- showcase 可以独立 build / run
- 主界面在静态截图下就能看懂主题
- 鼠标拖动 / drop / cursor 变化在真实运行态可见
- 不引入无关复杂度
- 代码和提交粒度保持干净

## Steps

### Step 1: Product shell and layout
- [x] 新建 showcase 目录与基础 scaffold
- [x] 完成截图友好的单屏布局
- [x] 标题、说明、主交互区就位
- **Verification:** build 通过，静态 UI 结构清晰

Step 1 的最小文件清单固定为：

- `showcases/pc-mouse-cursor/package.json`
- `showcases/pc-mouse-cursor/lynx.config.ts`
- `showcases/pc-mouse-cursor/rspack.config.ts`
- `showcases/pc-mouse-cursor/src/app/App.tsx`
- `showcases/pc-mouse-cursor/src/app/App.css`
- `showcases/pc-mouse-cursor/src/app/index.tsx`
- `showcases/pc-mouse-cursor/src/main/desktop/main.ts`
- `showcases/pc-mouse-cursor/src/main/desktop/preload.ts`
- `showcases/pc-mouse-cursor/src/main/desktop/vendorPaths.ts`

实现策略：

- 直接复用 `showcases/counter` 的最小 Lynxtron app scaffold 形状
- 先求 `buildable`，再补视觉和交互细节
- 不接受“只创建目录不落文件”的中间状态

### Step 2: Mouse / cursor behaviors
- [x] 主交互区支持 hover / mouse move 状态反馈
- [x] 使用单一交互方块突出 `cursor: crosshair` 和鼠标位置跟随
- [x] 至少有一个显式 hover target 用于博客截图
- **Verification:** 真实运行态下可见 hover / cursor 变化

### Step 2b: Visual polish for blog screenshot
- [x] 去掉实时变化的坐标主文案
- [x] 参考 `hello-world` 的中心构图、背景氛围和资产使用方式收敛视觉
- [x] 保持单 block 主体，不增加多余说明块或调试元素
- [x] 如需素材，优先使用一个轻量 SVG/矢量风格元素
- **Verification:** build 通过，真实运行态截图下主题清晰，且用户人工验收认为“简单、直观、可上博客”

### Step 2c: Drag-to-desktop interaction redesign
- [x] 左侧 Lynx Logo SVG 可被鼠标点击并拖动
- [x] 右侧 Desktop SVG 可作为 drop target
- [x] Desktop 在 drag over 时有清晰但简洁的高亮反馈
- [x] drop 成功后 Logo 停在 Desktop 中央
- [x] cursor 使用 `grab / grabbing`
- **Verification:** build 通过；真实运行态截图与 DOM 均确认 drag / drop 故事成立

### Step 2d: Layout correction after PM visual review
- [x] 将 draggable source 改成 banner 形状的长方形
- [x] 让 drag source 与 drop target 都完整落在主画面中
- [x] 避免 drop target 超出舞台可视区域或被裁切
- [x] 保持单屏、简单、截图友好的 drag/drop 故事
- **Verification:** `pnpm --dir showcases/pc-mouse-cursor build` 通过；PM 用真实运行态 + DevTool 截图确认主画面已收敛为横向 banner，左 source 与右 drop zone 无需脑补即可读懂

### Step 2e: Hello-world-inspired visual polish
- [x] 参考 `lynx-examples/hello-world` 调整海报式背景和视觉层次
- [x] 补入 Source / Desktop 区域标签和中轴导轨，增强截图可读性
- [x] 将左侧拖拽素材从 SVG 改为 PNG，以规避当前 Lynx SVG 组件限制
- [x] 保持 drag/drop 交互故事不变，只做视觉可读性增强
- **Verification:** `pnpm --dir showcases/pc-mouse-cursor build` 通过；PM 使用真实运行态与 DevTool 截图确认新视觉层次已生效，左侧拖拽物在深色背景上可辨识

### Step 3: Registry / gallery integration
- [ ] 补 showcase metadata
- [ ] 接入 registry
- [ ] 在 GO gallery 中可见
- **Verification:** `pnpm run generate-registry` 正常，GO 中可发现

### Step 4: Docs closeout
- [ ] 更新 status log
- [ ] 记录其用途是博客截图与 PC 特性展示
- **Verification:** PM 验收通过，文档同步完成

## Verification Rules

- 属于 Lynx UI showcase，必须参考 `https://lynxjs.org/llms.txt`
- 先追求清晰和截图效果，再追求功能扩展
- 至少要做 scoped build + 一次真实运行态 smoke

## Notes

- 这是一个“展示能力”的 showcase，不是产品 demo
- 可以偏海报式构图，但不能过度装饰
- 当前视觉参考以 `lynx-website/docs/public/lynx-examples/hello-world` 的单屏海报式结构为准，而不是复杂仪表盘或交互控制台
- 当前产品故事以 “Drag Lynx onto desktop” 为准，不再把实时坐标读数作为主展示内容

## History

- 2026-04-03: 多个 subagent 在 scaffold 阶段未能稳定落文件，后续执行必须以最小文件清单和 `counter` scaffold 为准，不再依赖开放式实现描述
- 2026-04-03: 直接实现 `pc-mouse-cursor` 最小 showcase，真实运行态已确认单 block 结构、hover 状态和鼠标位置跟随成立
- 2026-04-07: 产品设计从“实时坐标跟随海报”进一步收敛为“Drag Lynx onto desktop”的单屏 PC 交互故事，旧海报版作为中间里程碑保留在历史提交中
- 2026-04-07: `28f81e7` 完成拖拽重构，当前 showcase 已收敛为“左侧可拖动 Lynx Logo + 右侧 Desktop drop target”的最终展示态
- 2026-04-07: PM 复审后打回 `28f81e7` 的构图表现：drag source 过于接近正方形，drop target 超出主画面可视区域；需补一轮 layout correction
- 2026-04-07: layout correction 已完成，当前展示态明确收敛为横向长方形 banner：左侧 source panel + 右侧 drop zone，二者都完整落在主舞台中
- 2026-04-08: 继续按 `hello-world` 的单屏海报风格做视觉 polish，补入 Stage glow / rail / zone label，并将左侧素材切为 PNG 版本以规避当前 Lynx SVG 组件限制
