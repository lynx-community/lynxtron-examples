# `cover-view` input paste repro

Minimal A/B probe for Lynxtron 0.0.8 on macOS. It removes QuickPicker and all
application keyboard handlers, leaving only the native Edit menu roles.

- A: ordinary Lynx `<input>`
- B: the same component inside a bounded `<cover-view>`

Copy `renderer.js`, focus each field, and press Cmd+V. The page prints every
`focus`, `blur`, `selection`, and `input` callback plus the controlled value.
The application menu contains the standard `{ role: 'paste' }` item, exactly
like Lynxtron Fiddle; there is no JavaScript key or paste handler.

```sh
npm run start
```
