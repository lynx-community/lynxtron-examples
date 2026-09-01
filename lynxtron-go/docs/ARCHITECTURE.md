# Lynxtron Go architecture

Status: current implementation overview. Update this document with structural
product changes.

Lynxtron Go is a desktop project editor and showcase runner built with a Lynx
renderer and a Node.js desktop host. It has two editor surfaces that share host
services and process infrastructure.

## Runtime layers

```text
ReactLynx renderer
  ├─ Project editor (internal module name: Fiddle)
  ├─ Gallery and command palette
  └─ Legacy workspace IDE
          │ NativeModules bridge
Desktop preload services
  ├─ filesystem, dialogs, config, clipboard, PTY
  ├─ showcase installation and execution
  └─ extension-host transport
          │ Node IPC / child processes
Desktop host
  ├─ LynxWindow lifecycle and application menus
  ├─ independent project/showcase processes
  └─ extension host
```

The renderer is not a browser. UI uses ReactLynx built-ins such as `view`,
`text`, `image`, and `scroll-view`. Filesystem and process access stay in
preload or host services and are exposed through narrow bridge APIs.

## Product surfaces

### Project editor

`src/app/fiddle/` is the internal compatibility name for the default project
editor. Product copy calls its editable unit a Project. It owns:

- the command bar, Gallery overlay, settings, versions, and welcome tour;
- a project file tree and multiple native Scintilla editor panes;
- session restore, local folders, complete starter projects, and GitHub Gists;
- build/run orchestration and the shared process console.

The `fiddle:*` event namespace, persisted config keys, and TypeScript symbols
remain internal compatibility identifiers.

### Gallery

`src/app/components/Gallery/` renders the build-time showcase registry.
Opening a showcase materializes an editable workspace and loads it into the
project editor. Running launches an independent Lynxtron process.

Internal Gallery entries are compiled but hidden by default. A development build
can restore Electron Fiddles and Hello Lynxtron cards with
`LYNXTRON_GALLERY_INTERNAL_SHOWCASES=1`.

### Workspace IDE

`src/app/components/IDE/` is the folder-oriented workspace surface. It owns
tabs, the explorer/search sidebar, the status bar, and the terminal/output/
problems bottom panel. Opening a folder in the IDE uses a separate window so it
does not replace the active project-editor session.

## Layout

`SplitContainer` is the shared two-pane layout primitive. It measures its own
container, clamps ratios by minimum pixel size, and uses a drag overlay so native
editor views cannot steal pointer release events.

Current composition:

- Project editor: sidebar/editors split inside an editor/console split.
- Workspace IDE: Activity Bar + sidebar/editor split + collapsible bottom panel.
- Project sidebar: files/modules vertical split.
- Editor mosaic: independently managed by the project-editor state.

`PanelRegistry` supplies the workspace Activity Bar and bottom-panel entries.
The registry is static; arbitrary panel drag-and-drop, a serializable layout
tree, and plugin-defined panels are not implemented.

Workspace split ratios and panel visibility are persisted through host config.
Project-editor ratios are currently component-local.

## Language services

The renderer sends debounced document snapshots through the preload bridge to
`src/extension-host/`, a Node child process. The extension host provides:

- TypeScript, JavaScript, TSX, and JSX diagnostics using
  `ts.LanguageService`;
- CSS, SCSS, and Less diagnostics using
  `vscode-css-languageservice`.

Diagnostics return through the preload service, are converted from line/column
ranges to UTF-8 byte ranges, and are painted with Scintilla indicators. The
project editor uses stable real or virtual document paths so language services
can resolve project configuration and package types.

Real-time syntax styling remains renderer-local. Completion, go-to-definition,
rename, clangd, and pyright integration are future work.

## Project and showcase execution

The showcase registry is baked into the Lynx bundle by `lynx.config.ts`.
Released showcases are editable packages containing source,
`.lynxtron-release.json`, and verified `dist_precompiled/` artifacts.

Execution policy:

1. Use a verified precompiled target when the source and artifact hashes match.
2. Build from source when the project is edited or an artifact is missing,
   incomplete, or corrupt.
3. Always build custom projects from source.

The CLI package owns release-format verification and source builds. Desktop
preload services own installation, caching, process launch, and output capture.

## Build outputs

- RSpeedy builds `output/bundle/lynx/main.lynx.bundle`.
- Rspack builds the desktop host under `dist/desktop/`.
- The installer build also stages the CLI, runtime dependencies, native
  extensions, brand assets, and built-in showcase artifacts.

See the [Showcase Development Guide](../../docs/showcase-development.md) for
artifact layout and release behavior.
