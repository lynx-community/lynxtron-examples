---
'@lynxtron-examples/electron-fiddles': minor
'@lynxtron-examples/config': patch
'lynxtron-go': minor
---

Add the `electron-fiddles` showcase — the complete Electron `docs/fiddles` set
ported to Lynxtron (55 fiddles: 37 working, 7 partial, 11 N/A) — and surface it
as a dedicated "Electron Fiddles" section in the Lynxtron GO gallery.

- `electron-fiddles`: one rspeedy multi-entry project (one Lynx bundle per
  fiddle plus a `main` gallery bundle) over a shared main process. The catalog
  is checked 1:1 against upstream, and every status is re-verified against the
  Lynxtron 0.0.7 API surface.
- `config`: `createShowcaseConfig` gains `entries` (multi-entry showcases) and
  `server`, so the fiddles project can use the shared showcase config instead of
  hand-rolling one — which is what gives it `alignMouseEventWithW3C`.
- `lynxtron-go`: the gallery bakes in the fiddle catalog and lists all 55
  fiddles grouped by upstream category with status badges, separate from the
  featured-showcase grid.
