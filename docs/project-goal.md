# Project Goal

## Summary

Lynxtron Showcases 是一个面向外部开发者与 Lynx 生态使用者的展示型仓库，用来通过可运行的桌面应用和跨端样例，帮助用户快速判断 Lynxtron 是否值得深入了解。

## Final Goal

提供一套可以直接运行、直接演示、直接阅读源码的 showcase 体系，并以 Lynxtron GO 作为统一入口，在 5 分钟内完成核心价值传达：

1. 更轻量、更快
2. 原生扩展是一等公民
3. 同一份 Lynx UI 代码可以覆盖桌面与 Web，并延展到移动端原生

## Target Users

- Lynx 开源社区开发者
- 正在评估 Electron 替代方案的桌面应用开发者
- 需要快速理解 Lynxtron 定位和能力边界的内部/外部技术同学

## Core Scenarios

- 用户启动 Lynxtron GO，直接浏览 showcase gallery 并运行示例
- 用户从官网、文档或博客中的 `lynxtron://` 深链直接打开指定 showcase 或 Lynx example
- 用户从外部 deep link 直接进入目标 workspace，并定位到指定文件与行号
- 用户通过 Benchmark 直观感受体积、启动和交互性能
- 用户通过 Native Texture Canvas 理解 Lynx UI 与 native view 的协作方式
- 用户通过 Cross-Platform Notes 理解同一套 UI 在 desktop/web 的共享路径
- 用户在体验后 clone showcase 代码并本地运行

## Functional Description

- Lynxtron GO 提供 gallery、metadata、缩略图与 showcase runner
- Lynxtron GO 提供可被外部 deep link 唤起的 URL scheme 入口，用于直接进入 home、showcase 或 example workspace
- Lynxtron GO 的 deep link 入口支持在打开 showcase / example 后继续定位到 workspace 内指定文件和行号
- 每个 showcase 是完整的 Lynxtron app，包含 UI、desktop host，必要时包含 web host
- Preview 流程提供 pack、local registry、build、launch 的一站式体验
- 文档与 workflow 为 PM 驱动开发、验收、提交和状态同步提供统一基线

## In Scope

- Benchmark Dashboard
- Native Texture Canvas
- Cross-Platform Notes
- Counter
- Lynxtron GO gallery + runner
- 安装、preview、runtime 验收相关文档和工具链

## Out of Scope

- 完整 IDE 产品化，与 VS Code 竞争
- 移动端 showcase 工程化落地
- 完整性能测试平台
- 文档官网重构

## Success Criteria

- 10 秒内理解“这是什么”
- 30 秒内运行至少一个 showcase 并看到关键价值
- 2 分钟内理解轻量 / 原生扩展 / 跨端三条差异化叙事
- 5 分钟内决定是否值得继续试用或阅读源码

## Open Questions

- Cross-Platform Notes 何时接入 Lynxtron GO gallery / registry 主链路
- 是否将 runtime 非致命 warning 作为下一阶段单独目标推进
- Native Texture Canvas phase 2 的优先级是否高于展示层 polish
