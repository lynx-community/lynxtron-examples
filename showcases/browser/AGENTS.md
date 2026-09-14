# Browser showcase

This is a complete Lynxtron application: Lynx UI, Node host, and CEF native
payload. Keep the UI and native host together when verifying changes.

- Use Lynx elements and `@lynx-js/react`; browser globals are valid only inside
  JavaScript passed to the embedded webview, not in Lynx UI itself.
- Preserve the original macOS styles and traffic-light behavior. Windows uses
  maximize/restore, separately from macOS fullscreen.
- `NativeModules.bridge.call(method, payload, reply)` is callback-based.
- Create windows inside `app.whenReady()` after CEF initialization. Use the
  development plugin and builder's AutoLink support to stage native artifacts.
- Use Node.js matching the package's `engines.node`. Allow the native install
  scripts; CEF 0.0.22 shares a default profile, so another CEF host can prevent
  initialization. Explain that error rather than hiding it.
- Run `npm run build`, `npm run typecheck`, and `npm test`. Verify real browser
  navigation, tabs, window controls, and the packed application as described in
  README.md. A build or a visible window alone is not acceptance.
- First DevTool connection: if the session list is empty, exit and restart the
  App, then discover its current client address again.

Read https://lynxjs.org/llms.txt before changing Lynx UI and prefer the installed
package's types for the runtime API contract.
