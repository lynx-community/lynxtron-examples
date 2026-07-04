# Lynxtron GO Showcase Web Workflow

## Operating Model

- 当前文档只服务于 `lynxtron-go` 的 showcase Web 运行能力
- 先冻结语义与验收，再推进实现
- 在 host bridge 没补齐前，不接受把当前 UI 改动标记为完成

## Verification

- docs-only
  - 不要求 runtime 验证
- registry / metadata change
  - 至少验证 registry 生成或相关 build
- UI change
  - 至少验证 `lynxtron-go` build
  - 至少验证 command gating / menu / gallery 的最小测试或观察结果
- host bridge / desktop runtime change
  - 至少验证 `pnpm --dir lynxtron-go build`
  - 至少验证一个真实 showcase 的最小 smoke
- Web run/debug integration
  - 必须以 `showcases/cross-platform-notes` 为基准做最小 smoke
  - `Run on Web` 至少验证：
    - 子进程或本地 server 启动成功
    - 本地 URL 可达或浏览器已被拉起
  - `Debug on Web` 至少验证：
    - `npm run dev:web` 路径已被实际触发
    - GO 能感知 pid / status

## Acceptance

- `targets` 契约与 UI gating 一致
- `Run on Web / Debug on Web` 只对 Web-capable showcase 暴露
- host bridge 与 UI 调用链一致
- 所需 build / smoke 已实际执行
- 若 built web / source web 任一主路径未验证，则任务不能按完成态收口

## Commit Policy

- registry / metadata 改动与 host runtime 改动尽量拆开
- host bridge / server plumbing 与 Gallery / command UI 改动尽量拆开
- docs 收口单独提交，不与未验证的实现混在一起

## Blocker Handling

- 若 UI 已调用但 host API 未实现，视为 blocker，不接受按完成态提交
- 若 browser / local server smoke 未完成，视为 blocker，不接受按完成态提交
- 若 `targets` 推断与 showcase 真实脚本不一致，必须先收敛元数据规则，再继续 UI 接线

## Status Updates

- 计划变化写入 `docs/lynxtron-go-showcase-web-plan.md`
- 执行状态写入 `docs/lynxtron-go-showcase-web-status.md`
- 若当前 feature 与历史 `Start / Dev` 文档冲突，以本套文档为当前基线
