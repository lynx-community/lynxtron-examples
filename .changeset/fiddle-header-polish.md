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

- **Menu item text was invisible.** Lynx `<text>` does not inherit colour or
  size from its parent `<view>`, and `.bp3-menu-item-text` set neither — the
  styling lived on the item wrapper. Icons and accelerators showed because they
  set their own. The Menu primitive had never been rendered before this change,
  so nothing had exercised it.

- **Editor panes read as objects.** Each pane closes with a hairline instead of
  relying on gutter gaps alone, and the focused one states itself structurally —
  brighter edge, lifted toolbar — rather than by tinting its title. The toolbar
  drops from 30px to 28px, loses the doubled separator (a top border *and* a
  drop shadow, for one edge that the gutter already draws) in favour of a single
  rule under the label, and sets the file path in monospace at 12px so chrome
  sits below the code it names. The control cluster is no longer
  `transform: scale(0.75)` — scaling shrank the hit targets and knocked the
  glyphs off the baseline; the buttons are simply sized small.
