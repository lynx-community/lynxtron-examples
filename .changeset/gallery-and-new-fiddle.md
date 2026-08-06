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
