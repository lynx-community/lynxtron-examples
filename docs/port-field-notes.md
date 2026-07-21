# Lynx / Lynxtron Port Field Notes

This document is an advisory probe checklist derived from the Electron Fiddle to Lynxtron Fiddle port. It complements the normative acceptance process in [`docs/port-manual.md`](./port-manual.md); it does not override that manual or define permanent Lynx behavior.

## Observed baseline and re-verification rule

The observations below were collected during the 2026 Fiddle port, approximately from an `alpha.9` source/runtime baseline to Lynxtron `0.0.3`, primarily on macOS. Exact package versions, platform revisions, and reproduction environments varied across individual investigations.

Treat every runtime-, toolchain-, export-, CSS-, asset-, protocol-, and platform-specific statement here as a hypothesis to probe on the target port. Re-verify it whenever Lynx, Lynxtron, Rspeedy, rspack, a native extension, or the operating system changes. In a task workflow, record:

```text
Observed on:
  Lynx/Lynxtron/toolchain versions, platform, and date
Probe:
  Minimal reproduction or inspection
Observed result:
  What happened in this target build
Workaround:
  What the port uses, if needed
Reverify when:
  Dependency, runtime, toolchain, or platform changes that could affect it
```

If a probe now succeeds, prefer the supported behavior and update the workflow rather than preserving an obsolete workaround.

## 1. CSS, layout, text, and hit testing

On the observed baseline, several browser-shaped constructs were dropped or behaved differently without a useful error. Probe the following matches found by the manual's CSS risk scan:

- `inline-flex` and `inline-block` did not reliably preserve horizontal layout. The working adaptation was `display: flex` with an explicit `flex-direction: row`.
- `flex: 1` could collapse to zero height beneath an auto-height parent. A definite parent or child height was used where the product required a stable pane.
- Complex structural selectors, including child-position selectors, were not assumed available. `:hover` existed in some desktop paths but was kept to non-critical color feedback.
- `text-transform` and CSS line-clamping assumptions were unreliable. User-visible uppercase was encoded in the string when required, and `text-maxline="1"` was probed for single-line truncation.
- CSS `min()` and `max()` required a probe. CSS custom properties and `aspect-ratio` worked in tested paths, but inline `var()` usage was less reliable than class-based declarations.
- Switching a critical element between `display: none` and a visible layout solely through hover could leave paint ghosts. React state-driven rendering avoided that path.
- Fully transparent interaction surfaces could be skipped by hit testing. Where an invisible hit area was unavoidable, a nearly transparent fill such as `rgba(0, 0, 0, 0.02)` was probed; `display: none` was used when the hit area must be released.
- The runtime accepted an `<input>` `value` prop in the tested build even when local types did not declare it. Treat runtime and type support as separate probes.

These are observations, not a substitute for a minimal target-runtime reproduction.

## 2. Images, SVG, fonts, and browser globals

SVG decoding produced blank output in the tested Lynxtron `0.0.3` paths. PNG through `<image>` was reliable enough for that port. An icon font loaded with `lynx.addFont` and a base64 `data:font/ttf` URL was another workable path, but the success callback could fire without proving that glyphs painted correctly. Verify icons visually in the real window.

Do not generalize that SVG is unsupported on every platform or later runtime. Probe the exact packaging and decoding path; until it passes, use an asset format already verified for the target distribution.

The Lynx UI did not provide the browser global `btoa` in the tested environment. Move encoding to a suitable Node boundary or use a target-compatible implementation. Do not add a broad browser shim merely for one helper.

## 3. Native-view lifecycle and rendering

The manually attached Scintilla view rendered above Lynx overlays because it was an operating-system child view rather than a parent-clipped Lynx child. The Fiddle workaround detached each visible native editor before a Lynx dialog and restored it afterward. The architectural fix is to make native views managed, clipped children of the Lynx hierarchy where the platform supports that model.

Additional observed probes and workarounds:

- Content sent before the first attach could be returned by `getText` while the view still painted blank. The workaround re-synchronized content after the first layout/attach and navigated to the initial line. One implementation used roughly 150 ms, but that delay is not a general contract; probe an event-driven repaint first.
- Native frames followed Lynx layout rectangles but were not clipped by Lynx ancestors. Host containers used `min-width: 0`, `min-height: 0`, and `overflow: hidden`, followed by real-window verification.
- Detaching during a Lynx-owned sash drag disrupted the tested interaction. Verify pointer capture and native hit testing before choosing detach as a general drag strategy.
- Attach calls could report no actionable visual failure. Screenshot or record the operating-system window instead of trusting the call result.

Plan `configure -> attach -> first layout -> synchronize -> hide/detach -> reattach -> destroy` explicitly, but keep timing workarounds versioned in the task workflow.

## 4. Bridge, module, and event probes

The Fiddle port found multiple cases where Electron-shaped expectations typechecked and then became a silent no-op:

- One bridge transport was callback-based: `bridge.call(method, payload, reply)`. Awaiting a two-argument call did not reach a useful completion path. The port wrapped the verified callback transport in a Promise. Inspect the target implementation before applying that wrapper elsewhere.
- Main-to-UI events used `win.sendGlobalEvent(event, data)` and the UI listened through `lynx.getJSModule('GlobalEventEmitter').addListener(...)`. A bare `GlobalEventEmitter` global was not present in the observed UI runtime.
- `NativeModules` and `lynx` were not exposed on `globalThis` to the tested DevTool/CDP context. An inability to inspect them from CDP did not prove the app lacked them.
- The ESM surface re-exported only part of the CommonJS `lynxtron` module in the tested package. Capabilities such as `Notification`, `BaseWindow`, or `utilityProcess` required inspecting the real exports and, where appropriate in Node code, `createRequire`. Do not assume this list applies to another package version.
- Some remembered or declared Electron-like names were absent or differed, including the tested `NativeImage` versus lowercase `nativeImage.createFromDataURL` path and APIs such as `globalShortcut`, `nativeTheme`, `desktopCapturer`, or `webContents`. Inspect package exports and run a narrow capability probe.
- A preload bridge intended as `foundation.*` was actually spread onto the exposed root, so `exposed.foundation.*` was `undefined`; optional chaining hid every call. Assert the actual root shape at startup and fail loudly for required capabilities.

For each bridge operation, record the transport, exposed object path, payload shape, completion mechanism, errors, and a visible end-to-end effect.

## 5. `file://`, resource loading, and fetch

On the observed baseline, `shell.openExternal` handled tested HTTP(S) URLs but did not open `file://` targets. The macOS workaround invoked the platform opener with an absolute validated path. Probe the target platform and avoid passing untrusted paths or commands.

The built-in `-on-fetch-resource` handling answered HTTP(S) requests but returned an empty response for tested `file://` requests. A replacement handler was possible because the hook was an EventEmitter listener. Before replacing anything:

- establish listener ownership;
- prefer a composable handler;
- restrict access to explicit allowed roots;
- canonicalize paths and reject traversal; and
- remove existing listeners only when their ownership and replacement scope are proven.

UI-side `fetch()` reached an unimplemented `request_func` on all versions tested during this port. The workaround was a host HTTP-service/native-extension boundary. Re-probe before adding that infrastructure to a newer runtime.

## 6. Output and diagnostics

Process output and application-level `appendOutput` were separate channels in the observed implementation. Empty console regions were sometimes an ownership problem rather than missing output.

The original `readProcessOutput` destructively cleared its buffer. Multiple polling consumers therefore stole lines from one another. The durable solution was one shared drain owner feeding a bounded log and non-destructive `readSince(cursor)` consumers, followed by a final drain after process exit.

Trace silent failures with one operation ID through native logging, the N-API boundary, preload/host logs, bridge replies, UI state, and the visible effect. In the tested environment, one JS probe wrote to `$TMPDIR/lynxtron_debug.log` rather than application stdout. Confirm the actual destination. Truncate data URLs and other large fields because oversized console messages can stall the diagnostic channel.

## 7. Verification and performance probes

Native child views were absent from Lynx DevTool screenshots. On macOS, `screencapture -x -l <CGWindowID>` captured the real window when the ID was resolved from the owning process; a native helper based only on `[NSApp keyWindow]` could fail when focus changed. Treat these as macOS techniques, not cross-platform APIs.

DevTool ports such as 8901 or 8902 moved after restarts and across instances. Match the session's bundle URL or another build-path identity before assuming a connection belongs to the current artifact. Keep console probes bounded.

Synthetic CDP touch events did not exercise the same path as a real mouse and could not validate the tested split-sash drag. Repeat critical focus, drag, key, hover, and native hit-testing flows through the operating-system input path.

For a scrolling performance investigation, `sample <pid>` showed that a development preset was periodically capturing the screen on the main thread; the editor was not the root cause. Profile first, then repeat without DevTool screenshots, recording, polling, or similar observers before changing UI code.

## 8. Multi-instance and worktree isolation

Global config files and `/tmp` command files collided across worktrees, self-hosted children, and parallel builds during the port. Namespace mutable files by a stable checkout identity, for example a short SHA-1 of the canonical checkout path, and define single-writer or lease behavior where multiple processes still share a namespace.

Instances with the same bundle identifier competed for focus and lifecycle ownership. Keyboard automation could target whichever instance was frontmost. Prefer a per-instance command channel that carries an instance identifier; do not use shared `/tmp` filenames.

On the tested macOS environment, inspecting another process with `ps` did not reliably reveal environment values needed by the investigation. Verify propagation through an observable, non-sensitive effect such as a title badge or scoped diagnostic instead of assuming process inspection proves it.

## 9. Upstream fidelity and intentional divergence

Reuse upstream algorithms and information architecture when they are platform-independent: layout math, command grouping, window drag regions, and design-system rules are less risky to adapt than to approximate. Record every deliberate difference in the workflow:

```text
Source behavior:
Target behavior:
Reason for divergence:
Verification:
Revisit condition:
```

This prevents a later contributor from treating an intentional target choice as a parity bug.

## 10. Sixty-second preflight

1. Run the manual's CSS risk scan and assign each relevant match a replacement or runtime probe.
2. Probe the target asset path; do not assume SVG or a font callback proves visible icons.
3. For every native view, plan clipping, first synchronization, overlay detach/reattach, and real-window verification.
4. Verify every bridge call's transport and actual exposed object path.
5. If the flow needs `file://` or UI `fetch()`, probe it before designing around it.
6. Give destructive process-output draining one owner and consumers independent cursors.
7. Namespace mutable state and command channels by checkout and instance.
8. Profile before optimizing and disable observation machinery during the comparison.
9. Record intentional upstream divergences.

## Copyable reference prompt

```text
Before implementing this port, read AGENTS.md, docs/port-manual.md, and
docs/port-field-notes.md. Treat docs/port-manual.md as the normative acceptance
process. Treat docs/port-field-notes.md as an advisory, version-sensitive probe
checklist: apply entries relevant to the declared runtime/platform, re-verify
them, and record the observed baseline and workaround in the workflow. Do not
turn field-note observations into permanent cross-version claims.
```
