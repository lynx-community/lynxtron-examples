---
'lynxtron-go': patch
---

Quick Open now opens files in the product you are looking at.

The palette was born with the IDE, and its file rows always went to
`openFile` — which writes App-level editor tabs that only the IDE renders. On
the Fiddle surface, which is where the app starts and where the gallery's Open
lands you, picking a file wrote it into state nothing displayed. Cmd+P looked
broken there because half of it was.

The palette stays App-level, since it has to float above both products, but its
rows now come from whichever product is mounted:

- **Fiddle surface** — the fiddle's own editors. Activating one calls the same
  `selectEditor` a sidebar click does, so a hidden file is revealed and focused
  rather than silently selected.
- **Workspace surface** — the indexed file tree, opening into IDE tabs as
  before.

Cmd+K is unaffected: commands are global and worked on both surfaces already.

Also fixes the row path rendering. It was `fullPath.replace(rootPath + '/',
'')`, and a string argument to `replace` substitutes the *first* match
anywhere — with no workspace root the pattern was just `/`, so
`src/app/App.tsx` rendered as `srcapp/App.tsx`.
