# Lynxtron Go

基于 Lynxtron（Lynx + Node.js）的桌面项目编辑器和 Showcase 运行环境，原生代码编辑器由 Scintilla 提供。

## 技术栈

- `lynx`
- `lynxtron`
- `TypeScript`
- `React`
- `RSpeedy` + `Rspack`
- `lynxtron-builder`（桌面安装包）

## 特性

- Gallery、项目编辑、构建和独立运行
- 原生 Scintilla 多编辑器布局
- TypeScript、JavaScript、CSS、SCSS 和 Less 诊断
- GitHub Gist 导入与发布
- macOS 和 Windows 安装包

## 环境准备

- NodeJS >= 22
- pnpm 10.x

[LynxDevTool](https://github.com/lynx-family/lynx-devtool/releases/) 仅在运行时检查和调试时需要。

## 使用指南

### 安装依赖

```sh
pnpm install
```

### 开发模式

```sh
# 启动 Lynx UI 和桌面 Host 的监听构建
pnpm --dir lynxtron-go dev

# 启动已经构建的桌面 Host，并开启 Inspector
pnpm --dir lynxtron-go run run-dev
```

### 构建与启动

```sh
# 完整构建
pnpm --dir lynxtron-go build

# 构建并启动桌面应用
pnpm --dir lynxtron-go start

# 类型检查和测试
pnpm --dir lynxtron-go run typecheck
pnpm --dir lynxtron-go test
```

### 应用打包

```sh
# 当前 macOS 架构
pnpm --dir lynxtron-go pack

# Windows x64 安装包
pnpm --dir lynxtron-go run pack:win
```

当前架构和历史设计文档见 [文档索引](docs/README.md)。
