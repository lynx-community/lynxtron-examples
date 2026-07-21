# Feature: Complete Cross-Platform Notes Showcase
- Created: 2026-05-09
- Status: implementation accepted; GO runtime smoke pending

## Goal

Close the remaining gaps in `showcases/cross-platform-notes` so it can be treated as a complete `Cross platforms` demo rather than only a buildable baseline.

## Scope

- Keep the artifact model as a full Lynxtron showcase.
- Preserve the distribution model:
  - source showcase under `showcases/cross-platform-notes`
  - desktop dist under `dist/desktop`
  - web dist under `dist/web`
  - packed showcase tarball for preview consumption
- Preserve runtime paths:
  - standalone desktop: `lynxtron ./dist/desktop`
  - standalone web: `npm run start:web`
  - GO built web: local static server over `dist/web`
  - GO source web: `npm run start:web` / `npm run dev:web`

## Implementation Tasks

1. [x] Make standalone source web self-contained without relying on undeclared `npx serve`.
2. [x] Make shared app TypeScript diagnostics pass.
3. [x] Restore the expected autosave debounce for note edits.
4. [x] Make dirty state include both title and content.
5. [x] Add root README documentation for what the showcase proves and how to run it.
6. [x] Verify the built web static server path over `dist/web`.
7. [x] Fix desktop runtime layout so the note list and editor render as the expected two-column experience.

## Acceptance

- `pnpm --dir showcases/cross-platform-notes exec tsc --noEmit -p src/app/tsconfig.json` passes.
- `pnpm --dir showcases/cross-platform-notes run build` passes.
- `pnpm --dir showcases/cross-platform-notes run build:web` passes.
- Local web server can serve:
  - `/`
  - `/main.web.bundle`
  - `/__lynx_web__/static/js/index.js`
- `pnpm --dir lynxtron-go exec vitest run src/app/commands/showcase-commands.test.ts src/main/desktop/showcase-install.test.ts` passes.
- `pnpm --dir lynxtron-go build` passes.

## Runtime Smoke Still Required

- [x] Standalone desktop window smoke.
- [x] Standalone web server smoke.
- [x] Standalone browser visual smoke.
- [ ] GO `Run on Web` and `Debug on Web` click-path smoke.

The remaining unchecked item is a GO integration click-path smoke outside the showcase implementation itself.

## Status Log

- 2026-05-09: Workflow opened from PM evaluation. Implementation dispatched to a bounded worker with ownership of `showcases/cross-platform-notes/`.
- 2026-05-09: Implementation accepted after PM review. `pnpm install --frozen-lockfile` was run to align the local runtime package with the lockfile (`4.0.0-alpha.2-oss`), followed by `pnpm ignored-builds`.
- 2026-05-09: Verified `tsc`, desktop build, web build, standalone `start:web` server resources, GO command tests, and GO build.
- 2026-05-09: Standalone desktop runtime smoke passed through Lynx DevTool: DOM contained `notes-root`, note list, editor inputs, platform footer; screenshot confirmed the two-column notes layout. Runtime still logs known framework registry errors, but the app renders and DevTool reports no page console errors or warnings.
- 2026-05-09: Upgraded Lynx Web-related toolchain and removed the temporary Web CSS injection workaround. Standalone browser visual smoke passed: DevTools confirmed expected flex directions and screenshot confirmed the two-column Web layout.
- 2026-05-09: Centralized shared Lynx/Lynxtron/Rspack dependency versions in the pnpm workspace catalog. `pnpm preview:build` passed end-to-end.
