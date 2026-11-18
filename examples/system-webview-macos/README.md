# Embed the macOS system WebView

This standalone Lynxtron example embeds Apple's WKWebView as a Lynx custom
element. The heading is rendered by Lynx. The page and its counter button
are rendered by system WebKit. The example works offline and ships no CEF
runtime.

From the repository root on macOS, with Xcode Command Line Tools installed:

```sh
pnpm install
pnpm --filter @lynxtron-examples/config build
pnpm --filter @lynxtron-examples/system-webview-macos run build:macos
pnpm --filter @lynxtron-examples/system-webview-macos start
```

Click **Count: 0** inside the page to run its JavaScript. Resize the window
to see the native view follow the width of the Lynx element.

- [The UI](src/app/index.tsx) passes local HTML to the element.
- [The native view](system_webview.mm) registers the element, attaches
  WKWebView to the owning Lynx view, and applies Lynx layout and property updates.
- [The host](main.cjs) loads the compiled extension before creating the window.

This is a macOS source example, separate from the cross-platform CEF Browser showcase.
