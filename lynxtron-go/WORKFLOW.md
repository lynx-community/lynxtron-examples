# Workflow & Contribution Guidelines

为了保证代码质量和项目的可持续发展，所有贡献者（包括 AI Agent）必须遵循以下工作流程。

## 1. 核心原则
- **Plan First**: 任何非琐碎的更改前，必须先更新 `docs/lynxtron-go-ide-plan.md` 或创建 Todo List。
- **Test Driven**: 尽可能先编写测试用例，或在实现后立即补充测试。
- **Documented**: 代码必须有清晰的注释，架构变更必须同步到文档。
- **Atomic Commits**: 保持 Commit 粒度小且独立，Message 清晰。

## 2. 开发流程 (Development Cycle)

### Step 1: 计划 (Planning)
1.  **分析需求**: 理解用户意图。
2.  **更新文档**: 修改 `docs/lynxtron-go-ide-plan.md`，将大任务拆解为小 Task。
3.  **创建 Todo**: 使用 `TodoWrite` 工具列出具体的执行步骤。

### Step 2: 实现 (Implementation)
1.  **环境检查**: 确保处于正确的目录和分支（工作区模式下注意路径）。
2.  **编写代码**:
    - 遵循现有的代码风格 (TypeScript/C++)。
    - 优先修改现有文件，仅在必要时创建新文件。
    - **严禁** 硬编码路径或凭据。
3.  **调试验证**:
    - 使用 `DEBUG_STRATEGY.md` 中的手段进行验证。
    - 关键路径必须添加日志 (`utils.log`)。

### Step 3: 验证 (Verification)
1.  **编译检查**: 确保 `npm run build` 通过。
2.  **运行测试**: 执行 `npm test` (如有)。
3.  **手动测试**: 启动应用，验证功能是否符合预期。

### Step 4: 提交 (Commit)
1.  **清理**: 删除临时的调试代码 (除非是用于长期监控的日志)。
2.  **更新文档**: 检查是否需要更新 `README.md` 或 `AGENTS.md`。
3.  **Commit Message**:
    - 格式: `type(scope): subject`
    - 示例: `feat(editor): implement scintilla text setting via n-api`
    - 类型: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## 3. AI 协作规范 (Agent Collaboration)
- **自我检查**: 在回复用户前，检查是否遗漏了 Todo List 中的项。
- **主动纠错**: 发现之前的错误或不合理的代码，应主动提出并修复。
- **上下文感知**: 利用 `AGENTS.md` 和 `DEBUG_STRATEGY.md`快速获取项目背景。
- **文件操作**: 修改文件前，先 `Read` 确认内容；修改后，务必确认修改成功。

## 4. 目录结构规范
- `src/main`: 主进程代码。
- `src/app`: UI 代码 (Renderer)。
  - `App.tsx` / `App.css`: 布局 shell，组合所有组件。
  - `store.ts`: 共享类型（Tab, TreeNode）和 Native Bridge helpers。
  - `syntax.ts`: 语法高亮（Prism.js）。
  - `diagnostics.ts`: LSP 诊断 → Scintilla 指示器转换。
  - `components/`: 独立 UI 组件（每个组件有 `.tsx` + `.css`）。
    - `Sidebar/`: 文件浏览器树。
    - `TabBar/`: 水平可滚动标签栏。
    - `Editor/`: Scintilla 编辑器包装 + 欢迎页面。
    - `StatusBar/`: 状态栏（语言、消息、保存按钮）。
    - `QuickPicker/`: Cmd+P 文件搜索浮层。
- `src/extension-host/`: 语言服务扩展宿主。
- `scintilla-extension/`: Scintilla 特定的扩展封装。
- `lynx.config.ts`: 构建配置。

---
*遵循此规范，我们将共同打造一个高质量的 IDE。*
