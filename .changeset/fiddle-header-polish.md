---
'lynxtron-go': patch
---

Give the commands bar room to breathe, and the palette a way to be found.

- **The palette has a visible entry point.** ⌘P and ⌘K existed only as menu
  accelerators, so the feature was invisible unless you already knew it was
  there. A search button now sits beside Gallery — its sibling, one browsing by
  eye and the other by typing — and the accelerator *is* its label, rendered as
  data rather than prose.

- **Five right-hand buttons became two.** New Fiddle, Save, Gist History and
  Help moved into an overflow; all four already carry accelerators, and spending
  bar width on them squeezed the gist address into a field too narrow to read a
  URL in. Publish stays, because publishing has no key.

  The overflow is owned by the Fiddle shell rather than the bar: the 51px header
  clips its own children, so a menu anchored inside it can never open, and
  native editor views paint above all Lynx UI regardless of z-index — it joins
  the dialogs that already suppress the editors while open.

- **The gist field no longer resizes while you type.** It animated between two
  widths depending on whether it had content, so the field grew out from under
  the caret at the first keystroke. Fixed at 280px.

- **Accelerators look like accelerators.** Every shortcut shown in the UI — the
  palette button, every overflow item — now uses one key-cap treatment: 10px
  mono on a tinted ground, quiet by default and brought to full contrast on
  hover. Previously the palette hint was plain text large enough to compete with
  the label beside it.

- **Menu item text was invisible.** `.bp3-menu-item-text` carried `flex: 1`,
  whose zero basis collapses a `<text>` to zero width in a row: Lynx has no
  `min-content` and its shrink floor is `0px`, so nothing holds the text open
  the way `min-width: auto` does on the web. It grows with `flex-grow` and an
  `auto` basis instead. The Menu primitive had never been rendered before this
  change, so nothing had exercised it.

- **Editor panes read as objects.** Each pane closes with a hairline instead of
  relying on gutter gaps alone, and the focused one states itself structurally —
  brighter edge, lifted toolbar — rather than by tinting its title. The toolbar
  drops from 30px to 28px, loses the doubled separator (a top border *and* a
  drop shadow, for one edge that the gutter already draws) in favour of a single
  rule under the label, and sets the file path in monospace at 12px so chrome
  sits below the code it names. The control cluster is no longer
  `transform: scale(0.75)` — scaling shrank the hit targets and knocked the
  glyphs off the baseline; the buttons are simply sized small.

- **The bar has tooltips, and Console has dropped its label.** Lynx draws no
  tooltip and `title` is inert here — the only "tooltip" in the Lynxtron API is
  a vibrancy material name — so every `title` in this bar promised an
  affordance that did not exist, and no control could shed its word. A bar
  tooltip was blocked twice over: the header clips its children, and the native
  editor painted above all Lynx UI. Both are gone, so the bubble now renders
  through the shared platform overlay host, positioned from the anchor's
  measured rect. Console, whose label only repeated a panel already on screen,
  is now an icon.

- **The version button wears the Lynxtron mark** instead of `saved`, a tick
  that said "saved" — something that button has never meant. Two lockups ship,
  because the mark is a near-black disc that reads as a hole on the dark bar,
  and Lynx's `filter` has no `invert` to derive one at runtime.

- **The gallery's Electron Fiddles collection has a card.** All 55 sat below
  ten full-bleed cards, past two screens, with nothing on the first screen
  saying they existed. The collection now takes the first grid slot; its one
  action is Browse, because opening or running "all 55 fiddles" is exactly the
  confusion the collection was split up to avoid.
