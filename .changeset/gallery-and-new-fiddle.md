---
'lynxtron-go': patch
---

Put the gallery on the app's palette, and stop rendering the showcase registry
twice.

**The gallery was built on the ordinal `--background-N` tokens**, which carry no
meaning and drifted out of step when the window moved to role-named tiers:
`--background-2` is a near-black with a teal cast, so the page read as a
different application opening inside this one. It now uses the same three roles
as everywhere else — the page is chrome, each card is content, and the thumb
well and footer are washes over the card rather than a fourth and fifth tone.
The standalone overlay's hardcoded `#0b1220` goes with them, and the PREVIEW
badge stops being Blueprint blue.

**New Fiddle carried a second copy of the showcase registry** — the same eleven
entries the gallery renders, in a weaker card with no thumbnail, no actions and
tags as bare text. It also silently omitted the 55-entry Electron Fiddles
collection, so the list looked complete while showing a subset.

Two renderings of one registry is one too many, and the gallery's is strictly
the better one. The dialog now keeps only what exists nowhere else — Blank and
Hello Lynxtron — and hands off to the gallery for the rest. A dialog should hold
the choice you can make in a sentence; picking among eleven showcases and
deciding whether to open, run or IDE one is a page, and there is already a page
for it.

**The gallery's top bar follows the commands bar's grammar.** It had three
treatments for three controls — a text button with an arrow, a boxed button, and
bare lowercase text — and the boxed one put the page's strongest emphasis on its
weakest action: opening an arbitrary folder is an escape hatch, while the real
actions on this page live on the cards. All frameless now, with a divider
between navigation and actions, and the dev probe as a dim icon rather than a
third label competing with the two real controls.

Also removes a stale light-theme override that was repainting the cards' `Open`
Blueprint blue — the brand token already adapts per theme, so the override was
undoing the accent in exactly one of them.

**One rule for the IDE: it is always its own window.**

The IDE was reachable six ways and three of them swapped the shell inside the
running process — the Fiddle you were working in silently became a different
product. That also broke the assumption the one deliberate path was built
around: the Scintilla registry, its keyWindow attach, and the config-store
writer lease all assume one window per process, which is exactly why the
gallery's `IDE` action spawns a child. One entry point honoured that; the rest
went around it.

Now every "open a workspace" act spawns, and every command says where it goes:

- `File ▸ Open Folder in IDE…` and the palette's `Open Folder in IDE` (⇧⌘O)
  spawn a window instead of converting this one
- the palette's `Open Showcase from URL in IDE` — previously `Open Showcase
  (URL)`, which differed from `Open Showcase` only in landing you in a
  different product — does the same
- `File ▸ Open Fiddle Folder…` (⌘O) keeps loading a folder into this Fiddle,
  and now says so

The spawned window receives its folder by env rather than by deep link: the
deep-link scheme is a public contract with a parser and tests, and this is a
private handoff between a parent and the child it just spawned.

Also removes a duplicate delivery: `main.ts` answered the openFolder bridge call
both through its reply callback and as a `folderOpened` broadcast, a fallback
from when the reply was unreliable. Harmless while both did the same thing —
but with the callback now spawning, honouring the broadcast too would have
opened a new window *and* converted the old one.
