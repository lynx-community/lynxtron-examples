# Lynxtron Go documentation

This directory separates current product architecture from historical design
proposals.

## Current documentation

- [Architecture](ARCHITECTURE.md) — renderer surfaces, desktop host, project
  execution, layout, and language-service data flow.
- [Product README](../README.md) — setup, build, test, and packaging commands.
- [中文产品说明](../README.zh-cn.md) — 中文安装、构建和打包说明。
- [Showcase development guide](../../docs/showcase-development.md) — authoring,
  packaging, and releasing showcases.

## Archived design documents

The files under `archive/` are retained for design history. They are not an
API contract or an implementation guide:

- [Customizable layout design](archive/LAYOUT_ARCHITECTURE.md)
- [Language-services design](archive/LANGUAGE_SERVICES_ARCHITECTURE.md)

When behavior and documentation disagree, the source and tests are authoritative.
Update `ARCHITECTURE.md` when a structural change lands.
