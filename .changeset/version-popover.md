---
'lynxtron-go': patch
---

Make the Lynxtron version chooser a popover.

It was a 640px modal, which is the wrong object for it. The act here is picking
one value from a list and the pick applies immediately, so the modal's `Done`
confirmed nothing — it was a filled brand button whose only job was to close the
sheet it sat in, which also meant the app carried two filled brand controls
instead of one. And the control that opens it is a chevron, which promises a
menu dropping out of it.

It is an anchored popover now, built to the same rules as the commands overflow
beside it, so the bar has one kind of list-popover rather than two.

- **Section headers are labels, not bars.** They used to be full rows with their
  own ground, which let a scrolled catalog row slide underneath one — a
  half-clipped Download button sitting behind a section title.
- **One treatment for row actions.** Remove was red text, Download a boxed
  button, and the prereleases toggle a blue link: three answers to the same
  question inside four rows of content.
- **Selection is neutral and the brand is on the check mark.** The selected row
  was a stock VS Code blue, the last one left in the app.
- **No footer button bar** — nothing to confirm, so all that remains is the one
  act the list cannot offer: pointing at a runtime already on disk.
