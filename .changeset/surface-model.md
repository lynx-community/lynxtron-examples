---
'lynxtron-go': patch
---

Make the window show one product at a time, and make the menu reach it.

The app hosts two products — the Fiddle and the IDE workspace — but which one
you saw was the product of *two independent booleans*, and the menu was
hardwired to one of them. Nothing reconciled the two.

- **One surface.** The visible product was `legacyIdeOpen && route.kind ===
  'workspace'`: two flags for one mutually exclusive state, which made
  "workspace route, flag off" representable. In that state files opened into
  tabs nothing rendered, and Quick Open searched a workspace you thought you
  had left. It was reachable from the gallery: opening a fiddle while in a
  workspace cleared the flag but left the route. The surface is now derived
  from the route alone, so the state cannot be expressed.

- **The menu follows the surface.** `fiddle:*` events are handled by
  Fiddle.tsx and `ide:*` by App.tsx, and only one of the two is mounted. Since
  the Fiddle port rewrote the menu around `fiddle:*`, every IDE accelerator had
  been sending to an unmounted component: **Cmd+S, Cmd+W, Cmd+O, Cmd+F,
  Cmd+Shift+F and Cmd+J all did nothing in the IDE workspace**, and App.tsx's
  six matching listeners had no sender at all. The renderer now reports its
  surface and the menu is rebuilt for it, so each accelerator reaches the
  product that is actually mounted.

- **Each surface gets its own menu.** The workspace surface no longer shows
  New Fiddle, Run Fiddle, Stop Fiddle or Publish to Gist — none of which it can
  do — and gains Open Folder…, Close Tab, Find, Find in Files and Toggle Panel.
  The Fiddle surface is unchanged. Cmd+P and Cmd+K exist on both.

  Cmd+O in particular was not merely dead in the IDE: on the Fiddle surface it
  feeds the chosen folder to `loadLocalFiddle`, which rejects anything that is
  not already fiddle-shaped, so File ▸ Open could not open an ordinary project
  at all. The workspace surface now routes it to the IDE's own folder dialog.
