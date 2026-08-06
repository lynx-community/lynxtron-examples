---
'lynxtron-go': patch
---

Retire the last stock Blueprint button.

Every designed surface in this app had escaped `.bp3-button` by overriding every
property locally — the commands bar, the mosaic toolbar, the gallery top bar all
set their own height, size, radius and ground. So the base rule survived
untouched, and the buttons still wearing 2016 were exactly the ones on surfaces
nobody had redesigned: Settings and every dialog.

The base is now the scale everything else converged on — 28px, a 13px label, a
6px radius, one hairline — and loses the three things that dated it: a top-lit
**gradient sheen**, a fake border painted with an **inset box-shadow in a
hardcoded near-black**, and a `.theme-light` block that existed only to restore
stock Blueprint light values over stock Blueprint dark ones. Every colour is a
role token now, so the theme flips on its own.

Three bugs fell out of reading it closely:

- **`.bp3-button-icon { font-size }` was dead.** `<Icon>` writes `fontSize` as an
  inline style, which no stylesheet rule can outrank — so every button's glyph
  rendered at Icon's own 14px default, taller than the label beside it, and the
  commands bar's `13px` had never once applied. `Button` passes the size
  explicitly now, scaled with `small` / `large`.
- **`.bp3-button-text` pinned the label at 14px**, so `small` and `large` only
  ever changed the padding — a small button was a small box around a full-size
  label. The label inherits now.
- **`.bp3-intent-danger` was declared twice**, and the second copy silently kept
  the first one's gradient while looking like it had replaced it.

`intent-success` was `#0f9960` — a **second green** in an app whose brand is
green, near enough to read as the same colour and far enough to look like a
rendering fault when the two ever met. It is the brand now.

And the hierarchy those buttons sit in, by the rule the rest of the app follows —
one emphasis per group, everything else recedes:

- `Create Token on GitHub` leaves the app for a browser; it is a link, and
  framed it carried the same weight as `Sign In` beside it
- `Sign Out` likewise
- `Cancel` in every dialog — the escape, not a second action
- `Add Theme…` goes the other way and gets its frame back: a frameless button
  reads as pressable because its neighbours do, and this one is alone under a
  label, so with no edge it was indistinguishable from the helper text until the
  pointer happened to cross it

`fiddle:openSettings` takes a `panel` now. Three of the four Settings panes were
reachable only by clicking the nav, so they could not be captured or regressed
without a human at the keyboard — the same gap `fiddle:toggleGallery` closed.
