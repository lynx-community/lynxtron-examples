# Add port field notes and harden the one-shot manual

## Product intent

Fold the durable lessons from the Electron Fiddle port into the canonical one-shot port process while keeping runtime-version-specific observations explicitly versioned and re-verifiable.

## Scope

- Update `docs/port-manual.md` with durable rules for silent no-ops, CSS risk scans, runtime bridge contracts, single-owner destructive drains, cross-layer diagnosis, real-input verification, and intentional upstream divergences.
- Add `docs/port-field-notes.md` for toolchain-, runtime-, and platform-specific observations from the Fiddle port.
- Label field notes with their observed baseline and require re-verification after runtime or toolchain upgrades.
- Include a copyable prompt that makes `docs/port-manual.md` normative and `docs/port-field-notes.md` advisory.
- Do not change product code, dependencies, generated output, or existing runtime behavior.

## Acceptance criteria

1. The manual says that unsupported browser assumptions frequently fail as silent no-ops and therefore require end-to-end runtime checks.
2. It includes an actionable CSS risk scan without claiming all matches are permanently unsupported.
3. It requires verification of the real bridge transport and exposed object shape rather than trusting Electron precedent or type declarations.
4. It specifies one owner for destructive output drains and cursor-based non-destructive consumers.
5. It adds cross-layer operation tracing, measurement-before-performance-fixes, real-input/native-view verification, and an intentional-divergence record.
6. The field notes preserve concrete Fiddle-port observations but qualify version- or platform-sensitive claims and separate architectural rules from workarounds.
7. The reusable prompt clearly states how agents must reference both documents.
8. `git diff --check` passes; runtime verification is not required for this docs-only change.

## Verification

- Review both documents for contradictions and overly absolute runtime claims.
- Confirm the prompt treats the manual as acceptance criteria and field notes as a probe checklist.
- Run `git diff --check`.
- Confirm only the expected documentation files are changed before commit.
