# Language Services Architecture

> **Status**: Design document -- not yet implemented
> **Scope**: Real-time syntax highlighting, diagnostics, reference tracking, multi-language LSP integration.

---

## 1. Goals

| Feature | Priority |
|---------|----------|
| Real-time syntax highlighting (edit -> re-tokenize) | P0 |
| Syntax error squiggles (diagnostics) | P1 |
| Hover type info | P1 |
| Go-to definition / find references | P1 |
| Auto-complete (basic) | P2 |
| SCSS / Less support | P2 |
| C++ / Python via external language servers | P2 |
| Code formatting | P3 |
| Rename symbol | P3 |

---

## 2. Current Architecture (Before This Plan)

```
Renderer Process
  ReactLynx UI (App.tsx)
    ↓ NativeModules.ScintillaExtensionModule (N-API)
  Scintilla C++ Native NSView
    (no edit-change notifications to JS yet)

Syntax highlighting: Prism.js, called only on file open.
No LSP, no diagnostics.
```

---

## 3. Target Architecture

```
+------------------------------------------------------------------+
|  Renderer Process (Lynx UI Thread)                               |
|                                                                  |
|  ReactLynx UI (App.tsx)                                          |
|    |                                                             |
|    |  onContentChanged(text) <-- Scintilla SCN_MODIFIED callback |
|    |       |                                                     |
|    |       +-> Prism.js tokenize() -> applyStyles (debounce 80ms)|
|    |       |                           [real-time highlighting]  |
|    |       |                                                     |
|    |       +-> IPC to Main Process (debounced 300ms)            |
|    |             "textChanged" { uri, text, version }            |
|    |                                                             |
|    |  <-- IPC: "diagnostics" { uri, markers[] }                 |
|    |  <-- IPC: "completions" { items[] }                        |
|    |  <-- IPC: "hover"       { text }                           |
|    |  <-- IPC: "definition"  { uri, range }                     |
|                                                                  |
+------------------------------------------------------------------+
         IPC (Node.js EventEmitter / JSON over bridge)
+------------------------------------------------------------------+
|  Main Process (Node.js, main.ts)                                 |
|                                                                  |
|  LanguageClientManager                                           |
|    * Routes IPC from renderer to appropriate language client     |
|    * Multiplexes by file URI / language ID                       |
|    * Manages Extension Host child process lifecycle              |
|                                                                  |
+------------------------------------------------------------------+
         JSON-RPC (internal protocol over IPC channel)
+------------------------------------------------------------------+
|  Extension Host Process  (Node.js child_process.fork())          |
|                                                                  |
|  LSP Client Router                                               |
|    +-> TypeScript Language Service (in-process ts.LanguageService)|
|    |     Handles: .ts .tsx .js .jsx + tsconfig.json resolution   |
|    |     node_modules type resolution via @types/*               |
|    +-> vscode-css-languageservice (in-process npm package)       |
|    |     Handles: .css .scss .less                               |
|    +-> clangd (child process via stdio)                          |
|    |     Handles: .c .cc .cpp .h .mm                             |
|    +-> pylsp or pyright (child process via stdio)                |
|          Handles: .py                                            |
|                                                                  |
+------------------------------------------------------------------+
         LSP protocol (JSON-RPC over stdio)
+------------------------------------------------------------------+
|  Language Servers (external processes)                           |
|    clangd        -- C / C++ / Objective-C                        |
|    pyright       -- Python                                       |
+------------------------------------------------------------------+
```

---

## 4. Component Breakdown

### 4.1 Scintilla Edit Notifications (C++ -> JS)

**Problem**: Scintilla fires `SCN_MODIFIED` via its `SCNotification` mechanism, but currently no path back to JS exists.

**Phase 2a recommendation -- polling (unblocks Phase 2a without C++ changes)**:
- `setInterval(100ms)` calls `getText()`, compares length/hash with last-highlighted text
- On change detected: debounce 80ms -> `computeStyles()` -> `setStyles()`
- No new C++ code needed

**Phase 2b -- proper SCN_MODIFIED callback**:

```cpp
// In ScintillaViewContainer (scintilla_view.mm):
- (void)notification:(SCNotification*)n {
    if (n->nmhdr.code == SCN_MODIFIED
        && (n->modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT))) {
        // Call JS via napi_threadsafe_function stored in owner_
        owner_->FireContentChanged();
    }
}
```

New N-API binding:
```typescript
// Register a callback; called with (editorId: string, text: ArrayBuffer) on each edit
ScintillaExtensionModule.onContentChanged(editorId: string, cb: (buf: ArrayBuffer) => void): void
```

---

### 4.2 Real-Time Syntax Highlighting

**Location**: Renderer process only -- zero IPC latency, Prism.js already bundled.

**Flow**:
```
content change detected (poll or callback)
  -> debounce 80ms
  -> computeStyles(text, lang)  [Prism.js, typically <5ms for normal files]
  -> scintillaApi().setStyles(EDITOR_ID, 0, styles.buffer)
```

**Optimization for large files (>50KB)**:
- Only re-tokenize the visible range: `SCI_GETFIRSTVISIBLELINE` + `SCI_LINESONSCREEN`
- Pass `startPos` to `setStyles` for partial updates
- Prism.js tokenization is fast enough for full-file re-tokenize up to ~200KB

**Files to change**:
- `src/app/App.tsx` -- add change detection loop / callback handler
- `src/app/syntax.ts` -- no changes needed

---

### 4.3 IPC Protocol (Renderer <-> Main)

All messages are JSON objects sent over `NativeModules.bridge` (existing Lynxtron bridge).

**Renderer -> Main**:
```typescript
interface TextChangedMsg {
  type: 'ls:textChanged';
  uri: string;      // "file:///absolute/path.ts"
  text: string;
  version: number;  // monotonically increasing per file
  languageId: string; // "typescript" | "javascript" | "css" | ...
}

interface HoverRequestMsg {
  type: 'ls:hover';
  uri: string;
  line: number;      // 0-based
  character: number; // 0-based
}

interface CompletionRequestMsg {
  type: 'ls:completion';
  uri: string;
  line: number;
  character: number;
}

interface DefinitionRequestMsg {
  type: 'ls:definition';
  uri: string;
  line: number;
  character: number;
}
```

**Main -> Renderer**:
```typescript
interface DiagnosticsMsg {
  type: 'ls:diagnostics';
  uri: string;
  markers: DiagnosticMarker[];
}

interface DiagnosticMarker {
  startLine: number;   // 0-based
  startChar: number;
  endLine: number;
  endChar: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;     // "typescript" | "eslint" | ...
  code?: string | number;
}

interface HoverResponseMsg {
  type: 'ls:hoverResult';
  uri: string;
  markdown: string;    // type info as markdown string
}

interface CompletionResponseMsg {
  type: 'ls:completionResult';
  uri: string;
  items: CompletionItem[];
}

interface CompletionItem {
  label: string;
  kind: number;        // LSP CompletionItemKind
  detail?: string;
  insertText?: string;
}

interface DefinitionResponseMsg {
  type: 'ls:definitionResult';
  uri: string;
  targetUri: string;
  startLine: number;
  startChar: number;
}
```

---

### 4.4 Extension Host Process

**Entry point**: `src/extension-host/index.ts`

**Spawned by main process**:
```typescript
// In main.ts:
const host = child_process.fork(
  path.join(__dirname, 'extension-host/index.js'),
  [],
  { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] }
);

host.on('message', (msg) => {
  // Forward ls:diagnostics etc. to renderer via bridge
});

// Forward ls:textChanged etc. from renderer to host
rendererBridge.on('ls:textChanged', (msg) => host.send(msg));
```

---

### 4.5 TypeScript Language Service (In-Process)

**Package**: `typescript` (compiler API, no separate server process)

**Why in-process**: Lower latency than tsserver stdio, direct API access, simpler lifecycle.

```typescript
import ts from 'typescript';

class TypeScriptLanguageService {
  private service: ts.LanguageService;
  private fileVersions = new Map<string, { version: number; text: string }>();

  constructor(projectRoot: string) {
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists);
    const config = configPath
      ? ts.readJsonConfigFile(configPath, ts.sys.readFile)
      : ts.parseJsonConfigFileContent({ compilerOptions: { strict: true } }, ts.sys, projectRoot);

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...this.fileVersions.keys()],
      getScriptVersion: (f) => String(this.fileVersions.get(f)?.version ?? 0),
      getScriptSnapshot: (f) => {
        const entry = this.fileVersions.get(f);
        const text = entry?.text ?? (ts.sys.fileExists(f) ? ts.sys.readFile(f)! : undefined);
        return text != null ? ts.ScriptSnapshot.fromString(text) : undefined;
      },
      getCurrentDirectory: () => projectRoot,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    };
    this.service = ts.createLanguageService(host);
  }

  updateFile(filePath: string, text: string, version: number) {
    this.fileVersions.set(filePath, { version, text });
  }

  getDiagnostics(filePath: string): DiagnosticMarker[] {
    const diags = [
      ...this.service.getSyntacticDiagnostics(filePath),
      ...this.service.getSemanticDiagnostics(filePath),
    ];
    return diags.map(d => ({
      startLine: /* compute from d.start */ 0,
      startChar: 0,
      endLine: 0,
      endChar: 0,
      severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      source: 'typescript',
      code: d.code,
    }));
  }
}
```

**tsconfig.json resolution**:
- Walk up from opened file directory to find nearest `tsconfig.json`
- Respect `extends`, `paths`, `baseUrl` for monorepo support
- Re-load tsconfig when file changes (use `fs.watch`)

**node_modules type resolution**:
- Standard TS module resolution automatically resolves `@types/*` packages
- No special handling needed; `compilerOptions.moduleResolution` from tsconfig controls this

---

### 4.6 CSS / SCSS Language Service

**Package**: `vscode-css-languageservice` (same library used by VSCode)

```typescript
import { getCSSLanguageService, getSCSSLanguageService } from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

const cssLS = getCSSLanguageService();
const scssLS = getSCSSLanguageService();

function getLS(languageId: string) {
  return languageId === 'scss' ? scssLS : cssLS;
}

function getDiagnostics(uri: string, text: string, languageId: string): DiagnosticMarker[] {
  const doc = TextDocument.create(uri, languageId, 1, text);
  const ls = getLS(languageId);
  const stylesheet = ls.parseStylesheet(doc);
  return ls.doValidation(doc, stylesheet).map(convertLspDiagnostic);
}

function getCompletions(uri: string, text: string, line: number, char: number) {
  const doc = TextDocument.create(uri, 'css', 1, text);
  const pos = { line, character: char };
  const stylesheet = cssLS.parseStylesheet(doc);
  return cssLS.doComplete(doc, pos, stylesheet);
}
```

**Highlight grammar**: Prism.js handles CSS/SCSS highlighting (already imported). `vscode-css-languageservice` handles diagnostics and completions only.

---

### 4.7 C++ via clangd

**Approach**: Spawn `clangd` as a stdio LSP server.

**Discovery order**:
1. `clangd` in PATH
2. `clangd-18`, `clangd-17`, `clangd-16` in PATH
3. `/usr/bin/clangd`, `/usr/local/bin/clangd`

**Compilation database**: Look for `compile_commands.json` in:
- Project root
- `build/`, `cmake-build-*/`, `out/`
- Generated by CMake: `cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ...`

**Basic LSP client**:
```typescript
class LspStdioClient {
  private proc: ChildProcess;
  private pending = new Map<number, { resolve: Function; reject: Function }>();
  private requestId = 0;

  async start(command: string, args: string[], rootUri: string) {
    this.proc = spawn(command, args);
    this.proc.stdout.on('data', this.handleData.bind(this));
    await this.request('initialize', { rootUri, capabilities: LSP_CLIENT_CAPABILITIES });
    await this.notify('initialized', {});
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string, params: unknown) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private send(msg: object) {
    const body = JSON.stringify(msg);
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }
}
```

---

### 4.8 Python via pyright

**Approach**: Same as clangd -- spawn `pyright-langserver --stdio` or `pylsp`.

**Discovery**: `pyright-langserver` in PATH (installed via `npm i -g pyright` or bundled).

**Config**: Respects `pyrightconfig.json` or `pyproject.toml [tool.pyright]`.

---

### 4.9 Scintilla Diagnostic Rendering

Squiggly underlines via Scintilla's indicator API. Need new N-API methods in `scintilla_extension_module.cc`.

**New API surface**:
```typescript
// Add to scintilla_extension_module.cc + expose via NativeModules
ScintillaExtensionModule.setIndicators(editorId: string, indicators: {
  start: number;   // byte offset in document
  length: number;
  style: 0 | 1 | 2;  // 0=error(red squiggle), 1=warning(yellow), 2=info(blue)
}[]): void

ScintillaExtensionModule.clearIndicators(editorId: string): void
```

**C++ implementation sketch**:
```objc
// Reserve indicator slots: 0=error, 1=warning, 2=info
[sci message:SCI_INDICSETSTYLE wParam:0 lParam:INDIC_SQUIGGLE];
[sci message:SCI_INDICSETFORE  wParam:0 lParam:0x0000FF]; // red (BGR)
[sci message:SCI_INDICSETSTYLE wParam:1 lParam:INDIC_SQUIGGLE];
[sci message:SCI_INDICSETFORE  wParam:1 lParam:0x00AAFF]; // yellow (BGR)
[sci message:SCI_INDICSETSTYLE wParam:2 lParam:INDIC_SQUIGGLE];
[sci message:SCI_INDICSETFORE  wParam:2 lParam:0xFF8800]; // blue (BGR)

// Fill range:
[sci message:SCI_SETINDICATORCURRENT wParam:indicatorIndex lParam:0];
[sci message:SCI_INDICATORFILLRANGE  wParam:startPos lParam:length];

// Clear all:
[sci message:SCI_SETINDICATORCURRENT wParam:0 lParam:0];
[sci message:SCI_INDICATORCLEARRANGE wParam:0 lParam:totalLength];
```

---

### 4.10 Cursor Position (Required for Hover/Completion)

Need new N-API method:
```typescript
ScintillaExtensionModule.getCaretPosition(editorId: string): {
  byteOffset: number;
  line: number;    // 0-based
  column: number;  // 0-based, byte column
} | null
```

C++ via:
```objc
sptr_t pos = [sci message:SCI_GETCURRENTPOS wParam:0 lParam:0];
int line    = [sci message:SCI_LINEFROMPOSITION wParam:pos lParam:0];
int col     = pos - [sci message:SCI_POSITIONFROMLINE wParam:line lParam:0];
```

---

### 4.11 Completion Popup + Hover Tooltip

**Completion popup**: ReactLynx `<view>` overlay, absolutely positioned below cursor.
- Get caret pixel position via `SCI_POINTXFROMPOSITION` / `SCI_POINTYFROMPOSITION` (new N-API method)
- Render a scrollable list of `CompletionItem`
- Keyboard: arrow keys to navigate, Enter to insert, Escape to dismiss

**Hover tooltip**: ReactLynx `<view>` overlay shown on keyboard shortcut (Cmd+K Cmd+I) or after hover delay.
- Render markdown as plain text initially; add markdown renderer in future

---

## 5. Implementation Phases

### Phase 2a -- Real-Time Highlighting (No LSP, ~1 day)

Files changed: `src/app/App.tsx` only.

1. Add `useRef` for `lastHighlightText` and `lastHighlightLang`
2. `setInterval(150ms)` calls `getText()`, compares with last
3. On difference: `applyHighlight(newText, lang)` (already exists)
4. Clear interval on component unmount

### Phase 2b -- SCN_MODIFIED Callback (~2 days)

Files changed: `scintilla_view.mm`, `scintilla_view.h`, `scintilla_extension_module.cc`.

1. Add `napi_threadsafe_function changeCallback_` to `ScintillaView`
2. Implement Scintilla notification delegate in `ScintillaViewContainer`
3. New N-API binding `onContentChanged(editorId, cb)`
4. Replace polling from Phase 2a with callback

### Phase 3a -- TypeScript Diagnostics (~3 days)

New files:
- `src/extension-host/index.ts`
- `src/extension-host/typescript/ts-language-service.ts`

Changes:
- `src/main/desktop/main.ts` -- spawn Extension Host, IPC bridge
- `src/app/App.tsx` -- send `ls:textChanged`, receive `ls:diagnostics`
- `scintilla_extension_module.cc` -- add `setIndicators`, `clearIndicators`
- `package.json` -- add `typescript`, `vscode-languageserver-types`

### Phase 3b -- Completions + Hover (~2 days)

New files:
- `src/app/CompletionPopup.tsx`
- `src/app/HoverTooltip.tsx`

Changes:
- `src/extension-host/typescript/ts-language-service.ts` -- add completion/hover/definition
- `src/app/App.tsx` -- keyboard handlers, overlay rendering
- `scintilla_extension_module.cc` -- add `getCaretPosition`

### Phase 4a -- CSS / SCSS (~2 days)

New files:
- `src/extension-host/css/css-language-service.ts`

Changes:
- `src/app/syntax.ts` -- add `prism-scss` import
- `package.json` -- add `vscode-css-languageservice`, `vscode-languageserver-textdocument`

### Phase 4b -- C++ via clangd (~2-3 days)

New files:
- `src/extension-host/lsp/lsp-stdio-client.ts`
- `src/extension-host/lsp/clangd-client.ts`

### Phase 4c -- Python via pyright (~1 day, reuses lsp-stdio-client)

New files:
- `src/extension-host/lsp/python-client.ts`

---

## 6. File Structure (Post-Implementation)

```
src/
  extension-host/
    index.ts                      # Entry point, spawned by main
    language-client-manager.ts    # Routes requests to language services
    typescript/
      ts-language-service.ts      # TypeScript LanguageService wrapper
    css/
      css-language-service.ts     # vscode-css-languageservice wrapper
    lsp/
      lsp-stdio-client.ts         # Generic stdio JSON-RPC LSP client
      clangd-client.ts            # clangd spawn + config
      python-client.ts            # pyright/pylsp spawn + config
  main/desktop/
    main.ts                       # (existing; add Extension Host spawn + IPC)
  app/
    App.tsx                       # (existing; add change loop + IPC calls)
    syntax.ts                     # (existing; Prism.js)
    diagnostics.ts                # NEW: line/char <-> byte offset conversion
    CompletionPopup.tsx           # NEW: autocomplete overlay
    HoverTooltip.tsx              # NEW: hover info overlay
```

---

## 7. Dependencies to Add

| Package | Phase | Purpose | Where |
|---------|-------|---------|-------|
| `prismjs/components/prism-scss` | 2a | SCSS highlighting | Renderer |
| `typescript` | 3a | Compiler API for TS language service | Extension Host |
| `vscode-languageserver-types` | 3a | Shared LSP types | Extension Host |
| `vscode-css-languageservice` | 4a | CSS/SCSS diagnostics + completions | Extension Host |
| `vscode-languageserver-textdocument` | 4a | TextDocument utility | Extension Host |

External tools (user-installed, not bundled):
- `clangd` -- C/C++ (Phase 4b)
- `pyright-langserver` -- Python (Phase 4c)

---

## 8. Open Questions

| Question | Decision / Notes |
|----------|-----------------|
| IPC transport renderer <-> main | Use existing `NativeModules.bridge`; if not bidirectional, use preload's `ipcRenderer.on()` equivalent |
| How does current preload expose IPC? | `preload.ts` exposes capabilities on `NativeModules.nodejs.exposed`; need to add event-based IPC for push messages from main |
| Should Extension Host be persistent or per-workspace? | Persistent per IDE session; re-initialize language services when workspace changes |
| TypeScript strict mode vs. project tsconfig? | Always prefer project tsconfig; fall back to `{ strict: false }` for files outside any tsconfig |
| Completion trigger characters | `['.', '(', '<', '"', "'", '/', '@']` (standard TS triggers) |
| Max file size for diagnostics | Skip files >500KB; highlight-only mode |

---

## 9. Related Documents

- [docs/lynxtron-go-ide-plan.md](/Users/bytedance/ws2/lynxtron-show-cases/docs/lynxtron-go-ide-plan.md) -- Overall feature roadmap
- [DEBUG_STRATEGY.md](DEBUG_STRATEGY.md) -- Debugging guide
