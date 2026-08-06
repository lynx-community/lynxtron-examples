---
'lynxtron-go': patch
---

Modernize Settings, and spend the last of the Blueprint blue.

Settings was the one surface never touched by this design pass, and it still
carried the things the rest of the app has given up:

- **A blue selected nav item.** `--bp-selected-bg` is stock VS Code blue, and
  after the palette and the gallery gave theirs up this was one of the last.
  Selection is neutral now, as it is everywhere else.
- **Three checkboxes for one choice.** Dark / Light / System can only ever be
  one, but three checkboxes say "tick any number of these" — and left it
  possible to render a state with none ticked. It is a segment group, which
  says exclusive by its shape.
- **A footer with a filled `Done`.** Every change here is persisted the moment
  you make it, so `Done` confirmed nothing; it was a second filled brand
  control competing with Run for the one emphasis the window has.
- **A heading repeating the nav.** The pane said "Appearance" directly beside
  the highlighted "Appearance".
- **A stock input.** The font size field now wears the same recess as the gist
  URL, the module search and the palette query.

The `Dialog` primitive comes with it: a panel on the chrome tone behind a
hairline with a 10px radius, lifted by its shadow. The header was a second
surface stacked on the first — its own ground and a rule under it — so every
dialog began with two tones before any content.

And the last Blueprint blue is gone from the primitives, split by the rule the
rest of the app follows — **the brand goes on marks, never on surfaces**:

- marks → brand: checkbox tick, radio dot, spinner, the tour's current-step dot
- surfaces → neutral: menu selection, primary tag and toast grounds, callout
  wash, input focus ring
