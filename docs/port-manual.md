# One-Shot Port Manual

This manual is the canonical process for porting a Web, Electron, or React product into Lynxtron. It applies to full showcases, features inside Lynxtron GO, and pure Lynx UI example artifacts.

A one-shot port delivers one complete, useful product flow in a single implementation effort. It does **not** mean full upstream feature parity or a line-by-line translation. Preserve the source product's behavior and information architecture, then reimplement the platform-dependent parts for Lynxtron. A port is successful when its core flow runs from the real target distribution, handles failure, and cleans up correctly.

## 1. Define the port contract

Before changing code, write a workflow document for the task and fill in this contract:

```text
Source:
  Repository or path, revision, reference screenshots, and upstream launch command

Artifact type:
  Full Lynxtron showcase | Lynxtron GO feature | pure Lynx UI example artifact

Distribution type:
  Workspace source | packed showcase | preview distribution | published artifact

Runtime path:
  The exact UI bundle, desktop host, preload, and native-extension files that run

Golden flow:
  The shortest end-to-end user journey that proves the port is useful

Non-goals:
  Features and parity work intentionally excluded from this port
```

The artifact, distribution, and runtime entries are separate decisions. For example, a showcase is a complete application with `dist/desktop/`, while an example artifact is a pure Lynx UI package. Preview validates consumption of the packed distribution; it is not a source-mode shortcut. Name the exact files the runtime reads so that a successful build cannot be mistaken for a successful distribution.

Choose one golden flow that includes input, execution, visible output, and recovery or cleanup. For an IDE-like product it might be:

```text
Open a template -> edit a file -> run it -> inspect output -> stop it
```

If a feature is not necessary for that flow, put it in non-goals or assign it a lower priority. Do not leave scope implicit.

## 2. Inventory the source product

Inspect the running source product as well as its code. Record:

- Product flows: startup, primary actions, success, error recovery, and exit.
- UI surfaces: pages, panes, dialogs, menus, shortcuts, empty states, and responsive behavior.
- State: transient state, persisted settings, history, caches, and multi-instance ownership.
- System capabilities: files, processes, network, windows, clipboard, shell, and authentication.
- Dependencies: component libraries, editors, state libraries, DOM integrations, workers, and native modules.
- Assets: fonts, icons, SVG, bitmap images, HTML, and binaries.
- Build paths: entries, environment variables, intermediate output, packaged output, and launch commands.
- Platform differences: macOS, Windows, Web, and mobile behavior where relevant.

Classify every material capability before implementation:

| Classification | Meaning | Typical example |
| --- | --- | --- |
| `COPY` | Platform-independent logic can be reused with little or no change. | Parsers, reducers, validation, data models |
| `ADAPT` | Preserve the product behavior but rewrite the platform implementation. | React UI, layout, dialogs, persistence |
| `REPLACE` | Use an existing Lynxtron or repository-native capability. | Electron IPC to a preload bridge; Monaco to a supported native editor |
| `DEFER` | Useful but unnecessary for the golden flow. | Advanced history, drag reordering, secondary integrations |
| `DROP` | Inapplicable, redundant, or too costly for the target product. | Browser-only affordances or an entire unused component library |

Do not organize the inventory only by source directories. Organize it around user flows and the cross-layer capabilities each flow needs. This exposes incomplete paths early.

## 3. Map the source platform to Lynxtron

Treat the source as a product specification, not as code to translate mechanically.

| Web or Electron assumption | Lynxtron implementation |
| --- | --- |
| Hooks imported from `react` | Import hooks from `@lynx-js/react` |
| `<div>`, `<span>`, and other HTML elements | Use `<view>`, `<text>`, and `<image>` |
| `onClick` and `onChange` | Use `bindtap` and `bindinput` |
| `window`, `document`, and `localStorage` | Remove the dependency or expose a narrow preload capability |
| Node APIs in the renderer | Move the operation to preload or the host layer |
| Electron IPC | Use a typed Lynxtron bridge with explicit contracts |
| `BrowserWindow` | Use `LynxWindow` |
| DOM-backed editor or widget | Use a Lynx-compatible implementation or a managed native view |
| Browser CSS behavior | Verify the property and layout in the Lynx runtime |
| Browser globals such as `btoa` | Replace them with code supported by the actual target layer |

Apply these repository-specific rules:

- Lynx is not a browser. Do not introduce DOM or BOM compatibility shims into the UI.
- Declare a `useCallback` before every `useEffect` that references it. Lynx's strict temporal-dead-zone behavior can crash code tolerated by browsers.
- Treat `preload.ts` as standard Node.js plus Lynxtron bridge APIs unless real runtime evidence proves otherwise.
- Use `__non_webpack_require__` in preload when a dependency must bypass rspack's compile-time `require.resolve()` handling.
- Verify images, SVG, data URLs, text wrapping, flex behavior, and other browser-shaped assumptions in the real runtime.
- Never hide a missing critical bridge behind optional chaining or a silent no-op. Fail with an actionable error.

Prefer a small compatibility layer for the subset of a source component library that the port actually uses. Do not recreate or import an entire Web component system merely to preserve source-level APIs.

## 4. Establish the target architecture

Use four explicit layers. Keep contracts narrow and typed.

```text
Product state and Lynx UI
            |
            | typed bridge calls and events
            v
         Preload
            |
            | Node and Lynxtron APIs
            v
           Host
            |
            | only when required
            v
       Native extension
```

### Lynx UI

The UI owns presentation, user interaction, product state, input validation, and understandable error display. It must not directly read files, spawn processes, manipulate operating-system windows, or assume Node globals.

### Preload

Preload translates a small product-facing API into Node or Lynxtron operations. Expose specific operations such as `readProject`, `saveSettings`, `run`, `stop`, and `readOutput`; do not expose unrestricted `fs`, `child_process`, or arbitrary command execution. Validate the bridge contract at startup or at its boundary so missing capabilities fail loudly.

### Host

The host owns windows, menus, keyboard shortcuts, system dialogs, file protocols, application lifecycle, and child-process lifetime. Decide explicitly how application exit, crashes, and multiple instances affect owned resources.

### Native extension

Use a native extension only when the Lynx UI and host cannot provide the capability reliably, such as a native code editor. Treat it as a separate rendering and lifecycle system, not as an ordinary Lynx node.

Before implementing a bridge method, write down its input, output, errors, cancellation behavior, ownership, and cleanup. Test narrow contracts independently where practical.

## 5. Implement in vertical slices

Implement the golden flow end to end in this order. Each slice ends with the smallest real check that proves it works; do not finish an entire layer before connecting it to the next one.

### Slice 1: Boot

Create the target artifact, UI entry, host entry when required, main layout, initial state, and essential assets. Build and launch the actual target entry immediately. The gate is a real window or artifact showing the intended initial surface.

### Slice 2: Input

Connect the core user input: opening a project, choosing a template, editing content, or selecting a target. Replace temporary mock state with the real product state and bridge calls needed by the golden flow. The gate is input that survives the transitions required before execution.

### Slice 3: Execute

Connect the action that produces value across all required layers. For a runner, this normally means materializing a workspace, selecting the correct artifact, building if required, launching the runtime, and returning tracked process state. The gate is a real execution, not a simulated success response.

### Slice 4: Output and Stop

Expose progress, standard output, standard error, build failure, runtime failure, completion, cancellation, and retry. Implement idempotent Stop and complete resource cleanup. The gate is one successful run, one intentionally failed run with a useful message, and one stopped run with no owned process left behind.

### Slice 5: Persistence

Add settings and session recovery only after execution is reliable. Define the storage location, schema, corruption fallback, and writer ownership. Isolate state by checkout or application instance where worktrees and self-hosted children could otherwise share a global file. If multiple processes can write, use an explicit lease or single-writer policy; mark child or read-only instances deliberately.

### Slice 6: Polish

Finish the important visual and interaction details: typography, colors, icons, empty states, dialogs, text truncation, focus, pressed states, resizing, themes, and native-view first frames. Pixel parity and low-frequency refinements remain subordinate to the verified golden flow.

After every slice, update the workflow document with the result, the verification performed, and any newly discovered gap.

## 6. Use a complete runner protocol

If the port builds or launches another application, a runner is a lifecycle protocol, not a single `spawn()` call.

### Start

Record the executable, arguments, working directory, environment, source or artifact path, process identifier or process-group identifier, and start time. Define readiness and timeout behavior. Prefer the command that proves the user-visible runtime appears; do not assume a development server proves that the packaged application can launch.

### Output

Normalize output so the UI can consume it incrementally and consistently:

```ts
interface OutputEntry {
  cursor: number;
  timestamp: number;
  stream: 'stdout' | 'stderr' | 'system';
  message: string;
}
```

Use a monotonic cursor or equivalent ordering mechanism. Preserve useful diagnostics, apply bounded retention, and perform a final drain after process exit so the last stderr lines are not lost.

### Stop and cleanup

Launch an owned process group when the platform supports it and terminate the full tree, not only the immediate shell child. Make Stop idempotent. Clear tracked state only after exit is observed, handle escalation when graceful termination fails, and clean up owned children when the parent application exits. State explicitly whether any detached child is allowed to outlive the app.

### Build and launch paths

For every run, answer all four questions:

1. Where did the current build write its output?
2. Which exact file does the runtime read?
3. What packaging or copy step connects those locations?
4. How did verification prove the runtime did not load a stale bundle, native module, or old process?

When necessary, compare timestamps or hashes between intermediate and distributed files. Account for port conflicts, singleton locks, and leftover processes before diagnosing a framework failure.

## 7. Manage native views explicitly

A native view has its own rendering order and lifecycle. Implement and reason about every transition:

```text
create -> configure -> apply properties -> attach -> layout -> show
     -> hide/detach -> reattach -> destroy
```

Verify all of the following when a native view is present:

- Theme, font, content, and other initial properties are applied before the first visible frame.
- Content written before the first attachment repaints correctly.
- Hide, detach, and reattach preserve the expected state.
- Lynx dialogs and overlays are not covered by the native child view.
- Multiple panes have distinct native instances and identifiers.
- Resize, split layouts, scrolling, clipping, margins, and overscroll backgrounds behave correctly.
- Destruction releases native resources and callbacks.
- Every supported desktop platform is checked independently.

Lynx inspection tools may not capture an operating-system child view. Use a real window, system-level screenshot, or high-frame-rate screen recording for first-frame flashes, scrolling, and z-order issues.

## 8. Control scope with priorities

Assign every capability one priority and do not promote it silently.

### P0: required for the one-shot port

- The artifact builds and launches from its declared distribution path.
- The golden flow is complete with real input and output.
- Failures are visible and actionable.
- Stop and application exit clean up owned resources.
- The real runtime smoke check passes.

### P1: complete when time and risk allow

- Session persistence and recovery.
- Primary menus and shortcuts.
- Important dialogs, empty states, theme, and visual consistency.
- Expected resizing and multi-instance behavior.

### P2: defer unless the contract requires it

- Pixel-perfect parity and complex animation.
- Rare advanced tools, drag reordering, plugin markets, and secondary integrations.
- Authentication or publishing flows outside the golden path.
- Reimplementation of a complete upstream component framework.

If P0 is incomplete, the port is incomplete even when many P1 or P2 surfaces look finished.

## 9. Verify in layers

Verification is part of each slice and must target the declared artifact and distribution.

### Static checks

Run the narrowest applicable typecheck and lint checks. Search for HTML elements, DOM/BOM calls, hooks imported from `react`, browser globals, and silent bridge fallbacks. Confirm package imports and exports exist rather than relying on remembered APIs.

### Unit and contract tests

Test platform-independent state transitions, parsing, path resolution, configuration round trips, bridge validation, output ordering, and error classification. Add focused tests for behavior that previously failed across a layer boundary.

### Scoped build

Build the target with Node.js 22 or newer. Confirm that the UI bundle, desktop main, preload, assets, and native modules expected by the contract all reach the declared runtime path. A green intermediate build is not proof that `dist/desktop/` is current.

### Real-runtime smoke

Launch the same distribution entry a user or preview flow consumes. For a full showcase, this normally means launching `dist/desktop/`; for preview, prove that the packed showcase is consumed without a manual source rebuild. Record the command and observed result.

### Golden-flow smoke

Walk the complete path:

```text
launch -> provide core input -> execute -> observe the result
       -> force one representative failure -> recover
       -> stop or exit -> confirm cleanup -> relaunch if persistence applies
```

Inspect for residual processes, ports, files, and locks. Verify the final log output after exit.

### Visual and platform smoke

Use the real application window to check first frame, overlay order, truncation, icons, resizing, themes, and native views. Do not infer Windows behavior from macOS or infer native-view behavior from a Lynx-only screenshot.

Docs-only changes require Markdown review and `git diff --check`; they do not require runtime verification. Record that fact in the workflow rather than claiming a runtime test.

## 10. Definition of Done

A one-shot port is complete only when all applicable statements are true:

- The workflow records Source, Artifact type, Distribution type, Runtime path, Golden flow, and Non-goals.
- The inventory classifies source capabilities as `COPY`, `ADAPT`, `REPLACE`, `DEFER`, or `DROP`.
- The golden flow works from the real declared distribution, not only from source or a development server.
- No unsupported HTML, DOM, BOM, browser-global, or React-runtime assumptions remain in the Lynx UI.
- File, process, persistence, window, and native capabilities cross explicit typed boundaries.
- Missing critical bridge capabilities produce actionable errors.
- The relevant static checks, tests, build, runtime smoke, and golden-flow smoke pass.
- Success, representative failure, Stop, and parent-app exit have been verified.
- Build output and runtime input are proven to match; no stale bundle or native copy is being exercised.
- Persisted state has explicit ownership, corruption behavior, and multi-instance isolation where applicable.
- Native views, when present, pass lifecycle and real-window verification on supported platforms.
- Known gaps are listed honestly and assigned a priority; deferred parity is not reported as supported.
- The workflow records exact verification commands and results, including any blocked checks.
- No `node_modules`, build output, vendored dependency, temporary workspace, or generated artifact is committed unless explicitly required.
- The implementation is split into traceable commits only after its required verification passes.

## Copyable task prompt

Use this compact prompt for future ports. Fill in the contract instead of copying this manual into the task.

```text
One-shot port <SOURCE_PRODUCT> into <TARGET_PATH>.

Before implementation, read AGENTS.md, docs/port-manual.md, docs/product-plan.md
when present, and the relevant artifact-development documentation. Follow the
manual as the acceptance process, not merely as background reading.

Port Contract
- Source: <repository/path/revision and references>
- Artifact type: <full showcase | Lynxtron GO feature | pure Lynx UI artifact>
- Distribution type: <workspace | packed showcase | preview dist | published artifact>
- Runtime path: <exact UI/desktop/preload/native files that will execute>
- Golden flow: <one end-to-end user journey>
- Non-goals: <explicit exclusions>

First create a workflow document containing the contract, a
COPY/ADAPT/REPLACE/DEFER/DROP inventory, architecture, vertical slices, and
verification plan. Then implement Boot -> Input -> Execute -> Output/Stop ->
Persistence -> Polish, prioritizing the golden flow over upstream parity.

Verify the narrowest applicable static checks and tests, the target build, the
actual distribution/runtime path, one successful golden flow, one useful
failure, Stop/exit cleanup, and native-view behavior when present. Prove the
runtime is loading the current artifacts. Record commands, results, and known
gaps in the workflow. Do not treat a green build alone as completion, and do
not commit dependencies, build outputs, generated artifacts, or temporary files.
```
