# Project editor module

`fiddle` is the internal compatibility name for the project-editor shell that
replaces the folder-based IDE as the default landing. Product UI calls the
editable unit a **Project**. Keep the directory, event namespace, persisted
config keys, and TypeScript identifiers stable unless a migration is planned.

The implementation originated from Electron Fiddle, and these sub-directories
still mirror its renderer components:

- `Header/`  → upstream `src/renderer/components/{header,commands}.tsx`
- `Editors/` → upstream `src/renderer/components/{editors,editor,output-editors-wrapper}.tsx`
- `Sidebar/` → upstream `src/renderer/components/{sidebar,sidebar-file-tree}.tsx`
- `Outputs/` → upstream `src/renderer/components/{output,outputs}.tsx`
