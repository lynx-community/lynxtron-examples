# Lynxtron GO Showcase Web Goal

## Summary

为支持 `desktop + web` 多目标 showcase，给 `lynxtron-go` 增加一条明确的 Web 执行链路，让用户可以在 GO 中对支持 Web 的 showcase 执行 `Run on Web` 和 `Debug on Web`。

## Final Goal

用户在 `lynxtron-go` 中打开一个支持 Web target 的 showcase 后，应能：

- 明确看见该 showcase 支持 `web`
- 执行 `Run on Web`
- 执行 `Debug on Web`
- 让 GO 正确启动对应的 Web 运行路径，并提供可理解的状态反馈

该能力默认不破坏现有 desktop `Run / Debug`、preview、local-registry 和 example artifact 的主路径。

## Target Users

- 评估 Lynxtron 跨端能力的外部开发者
- 维护 `desktop + web` showcase 的作者
- 需要在 GO 中验证多目标 showcase 行为的内部开发者

## Core Scenarios

- 用户在 Gallery 中看到 `Cross-Platform Notes` 一类多目标 showcase，并直接点击 `Run on Web`
- 用户在已打开的 showcase workspace 中执行 `Run on Web`
- 用户在已打开的 showcase workspace 中执行 `Debug on Web`
- 不支持 Web 的 showcase 不显示或不暴露对应动作

## Functional Description

- showcase registry 需要携带稳定的 `targets` 元数据，最少支持：
  - `desktop`
  - `web`
- `lynxtron-go` 只对 `targets` 包含 `web` 的 showcase 暴露：
  - `Run on Web`
  - `Debug on Web`
- `Run on Web` 的语义固定为：
  - 若已有可消费的 `dist/web` 且源码未比产物更新，则运行 built web 路径
  - 否则走源码运行路径，准备依赖后执行 `npm run start:web`
- `Debug on Web` 的语义固定为：
  - 进入源码调试路径
  - 准备依赖后执行 `npm run dev:web`
- GO 负责启动和管理自己拉起的 Web 运行进程，并提供 pid / 状态反馈
- GO 不把 Web 页面嵌入自身窗口；第一版继续使用外部浏览器承载 Web 页面

## In Scope

- showcase `targets` 的 registry 模型和 bake 规则
- Gallery / command palette / Run menu 中的 Web 动作接线
- showcase host bridge 中的 Web 运行能力：
  - `getTargets`
  - `isWebBuilt`
  - `needsWebSourceRun`
  - `runWeb`
  - `startWeb`
  - `devWeb`
- built web 的最小本地 server 能力
- 至少一个真实多目标 showcase 的最小 smoke，基准为 `showcases/cross-platform-notes`

## Out of Scope

- example artifact 的 `Run on Web`
- folder workspace 的 `Run on Web`
- GO 内嵌 Web preview 窗口
- 复杂 browser orchestration，例如多标签管理、dev ready 轮询后多步跳转
- 把任意 showcase 自动判定为 Web capable，而不经过 `targets` 契约

## Success Criteria

- `targets` 能稳定进入 GO registry，并在 UI 决定 Web 动作是否可见
- `showcases/cross-platform-notes` 能在 GO 中完成：
  - `Run on Web`
  - `Debug on Web`
- 不支持 Web 的 showcase 不会错误暴露 Web 动作
- desktop `Run / Debug` 不被静默破坏

## Open Questions

- built web 路径是否必须自动打开默认浏览器，还是允许第一版只输出本地 URL
- built web server 是否由 GO 内置 server 承担，还是允许复用 showcase 自己的 `start:web` 脚本
