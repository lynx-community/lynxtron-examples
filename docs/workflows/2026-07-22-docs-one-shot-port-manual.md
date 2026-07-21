# Add a one-shot port manual

## Product intent

Turn the lessons from the Electron Fiddle port into a durable repository manual that can be inherited by every worktree created from `main`.

## Scope

- Add `docs/port-manual.md` as the canonical guide for one-shot ports into Lynxtron.
- Cover port contracts, source inventory, platform mapping, target architecture, vertical implementation slices, runner and native-view requirements, verification, and the definition of done.
- Include a short reusable agent prompt that references the manual instead of duplicating it.
- Keep the guide applicable to full showcases, Lynxtron GO features, and pure Lynx UI artifacts while requiring each task to state its artifact, distribution, and runtime model explicitly.
- Make no product-code, dependency, build-output, or generated-artifact changes.

## Acceptance criteria

1. `docs/port-manual.md` is self-contained and understandable without the preceding conversation.
2. The manual distinguishes a one-shot core-flow port from full upstream parity.
3. It records the repository's Lynx constraints and the main lessons from the Fiddle port, including bridge boundaries, stale artifacts, process-tree cleanup, native-view lifecycle, multi-instance state, and real-runtime verification.
4. It provides a compact copyable prompt for future port tasks.
5. Markdown formatting is checked, and no runtime verification is required for this docs-only change.

## Verification

- Review the rendered Markdown structure and links.
- Run `git diff --check`.
- Confirm only the two documentation files are changed before commit.
