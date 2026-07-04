# Chore: Repository Dead Code Cleanup
- Branch: current workspace
- Created: 2026-05-18
- Status: accepted

## Goal

清理仓库中可证明未引用的 dead code，优先覆盖 Lynxtron GO、showcases、packages 和脚本层的源码残留，降低后续 showcase 与 GO 迭代的阅读和维护成本。

## Artifact / Distribution / Runtime

- Artifact type: source maintenance across Lynxtron GO showcase app, standalone showcases, shared packages, and repo scripts.
- Distribution type: source workspace change; no packed artifact semantics should change.
- Runtime path: existing runtime paths only:
  - Lynxtron GO desktop window
  - standalone showcase desktop / web entries
  - CLI commands and preview scripts

## Product Definition

This is a maintenance chore, not a product behavior change.

In scope:

- Remove files, exports, functions, constants, styles, tests, fixtures, or local helpers that are not referenced by source, tests, build configs, package exports, or documented runtime entrypoints.
- Remove stale package scripts or dependencies only when the owning package has no source/test/build/runtime reference to them.
- Clean dead code in:
  - `lynxtron-go/src/app`
  - `lynxtron-go/src/main/desktop`
  - `lynxtron-go/src/extension-host`
  - `lynxtron-go/scintilla-extension`
  - `showcases/*`
  - `packages/*`
  - `scripts/*`

Out of scope:

- Rewriting architecture, moving live code for style, or broad file splitting.
- Removing public package exports, CLI command entrypoints, Lynxtron bridge APIs, config files, generated registry inputs, thumbnails, README assets, native extension entrypoints, or package files unless usage evidence proves they are unreachable.
- Removing `node_modules`, `dist`, `output`, cache directories, or local ignored artifacts as a source-code cleanup. Those are environment artifacts, not dead product code.
- Changing runtime behavior or showcase UX.

## Acceptance Target

- Every removed source item has clear evidence that it is unreachable or unused.
- No change relies only on filename intuition; dynamic entrypoints must be treated as live unless proven otherwise.
- Lynx UI files continue to use Lynx semantics (`view`, `text`, `image`, `bindtap`, no DOM/BOM assumptions).
- The relevant tests/builds pass after cleanup.
- Any suspected but unremoved dead code is recorded as follow-up with the reason it was not safely removed.

## Task Split

### Task A: Lynxtron GO App Layer

Owned scope:

- `lynxtron-go/src/app/**`
- `lynxtron-go/src/shared/**` only if referenced from app code

Required verification:

- `pnpm --dir lynxtron-go exec vitest run`
- `pnpm --dir lynxtron-go build`

### Task B: Lynxtron GO Host / Extension Layer

Owned scope:

- `lynxtron-go/src/main/desktop/**`
- `lynxtron-go/src/extension-host/**`
- `lynxtron-go/scintilla-extension/**`
- `lynxtron-go/scripts/**` if only referenced by GO package scripts

Required verification:

- `pnpm --dir lynxtron-go exec vitest run`
- `pnpm --dir lynxtron-go build`

### Task C: Showcases / Packages / Repo Scripts

Owned scope:

- `showcases/*/**`
- `packages/*/**`
- `scripts/**`
- root-level registry/package config only when needed to remove a proven stale reference

Required verification:

- `pnpm --dir packages/cli test`
- `pnpm --filter @lynxtron-showcases/cli build`
- Scoped showcase builds for any changed showcase
- `pnpm run generate-registry` if registry inputs or showcase package metadata change
- `pnpm preview:build` if distribution or preview scripts change

## Discovery Guidance

Use static evidence first:

- import/export graph
- `rg` references
- package `bin`, `main`, `files`, scripts, and workspace entries
- test references
- Rspack / Rspeedy / native extension entrypoints
- documented runtime bridge APIs

When evidence is ambiguous, do not delete. Record the candidate in the worker final note under "not removed".

## Delegation Requirements

Workers are not alone in the codebase. They must not revert edits made by others, and must keep changes inside the owned scope unless they explicitly report why a cross-scope touch is necessary.

Each worker final note must include:

- Files changed
- Dead-code evidence for each removal
- Verification commands and results
- Candidates considered but not removed
- Risks or follow-up recommendations

## History

- 2026-05-18: PM created workflow and prepared scoped implementation delegation.
- 2026-05-18: Worker A cleaned GO app layer dead code; PM reviewed scope and accepted after GO vitest/build.
- 2026-05-18: Worker B cleaned GO host/native/script dead code; PM reviewed native binding/script references and accepted after GO vitest/build.
- 2026-05-18: Worker C cleaned CLI/showcase/script dead code; PM reviewed package/build entrypoints and accepted after CLI/showcase/preview verification.
- 2026-05-20: Preview runtime smoke passed with `pnpm preview`; DevTool confirmed Gallery Home, `PREVIEW` badge, six local showcase cards, and no console errors/warnings.
