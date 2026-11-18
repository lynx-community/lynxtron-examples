# Embed the system WebView

The same Lynx custom element hosts WKWebView on macOS and the installed
Evergreen WebView2 Runtime on Windows x64. Lynx renders the heading. The native
WebView renders the local HTML page and runs its counter button.

## Run from the repository root

Use Xcode Command Line Tools on macOS. On Windows use x64 Node.js, Visual Studio
2022 with Desktop development with C++ and a Windows SDK, CMake 3.20 or newer,
and the [Evergreen WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
The first Windows build downloads the pinned WebView2 SDK from NuGet. Only
the loader is linked into the extension.

```sh
pnpm install
pnpm --filter @lynxtron-examples/config build
pnpm --filter @lynxtron-examples/system-webview run build:native-ui
pnpm --filter @lynxtron-examples/system-webview start
```

The window opens https://lynxjs.org/ in the native WebView. Choose **Show local page** to try the offline example, then **Open Lynx website** to go back.

Click **Increment** inside the page to update the counter. Resize the window to see the WebView follow
the width of the Lynx element. The local page works offline. WebView2 keeps its
profile in `%LOCALAPPDATA%\LynxtronSystemWebViewExample`.

[The UI](src/app/index.tsx) passes either HTML or an HTTPS URL to the custom element.
[The host](main.cjs) loads the compiled extension before opening a window.
The [macOS](system_webview.mm) and [Windows](system_webview_win.cc) implementations
register the same element and apply Lynx property, layout, and visibility updates.
