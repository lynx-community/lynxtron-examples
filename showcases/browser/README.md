# Lynxtron Browser

A complete browser showcase for Lynxtron Go, migrated from
[`lynx-family/lynxtron/src/packages/browser-demo`](https://github.com/lynx-family/lynxtron/tree/94794b7/src/packages/browser-demo).
The original Lynx UI, icons, and macOS styling are retained.

## Run in Lynxtron Go

Open the Browser showcase and choose **Run Showcase**. This is a full app with a
CEF host, not a UI-only bundle. Go's release catalog selects the Windows or macOS
artifact. A Go release containing this new catalog entry is required.

For local development in this repository:

```sh
pnpm --filter @lynxtron-examples/browser... install
pnpm --filter @lynxtron-examples/config build
pnpm --filter @lynxtron-examples/browser start
```

Use Node.js matching `^22.18.0 || ^24.0.0 || ^26.0.0`. The runtime, development
plugin, builder, and CEF package use the published 0.0.22 toolchain. Allow the CEF
package's install script to download the native payload. AutoLink stages the
matching platform files automatically; no manual framework copying is needed.

After Go exports the source project, run `npm install`, then `npm run start` in
that project. `npm run dev` starts desktop development; `npm run pack` builds a
standalone installer with the app ID `org.lynxtron.examples.browser`.

CEF 0.0.22 shares its default profile between host applications. If initialization
fails, close another app using CEF and retry; inspect the native error log for
other causes. Multiple tabs in this one host process are supported.

## Source map

- `src/app/App.tsx`: tabs, address submission, navigation, and webview events.
- `src/app/NewTab.tsx`: the complete tab component and close button.
- `src/app/HomePage.tsx`: the new-tab page.
- `src/app/App.css`: the original browser styles, including macOS traffic lights.
- `src/main/desktop/main.ts`: CEF initialization, window lifecycle, and controls.
- `rspack.config.ts`: host build and automatic native-library staging.
- `electron-builder.yml`: standalone installer configuration.

The web host inherited from the original demo is available through `build:web`;
the Go catalog advertises the desktop target, which supplies CEF and window APIs.

## Acceptance flow

1. Launch the source build and the unpacked release artifact.
2. Open a URL from the address bar and verify a rendered web page.
3. Add a tab, navigate elsewhere, and switch back to the original page.
4. Verify back, forward, refresh, and closing the selected tab.
5. Drag the title bar, maximize/restore, minimize/restore, then close the window.
6. Build the installer and repeat the page/navigation checks after installation.

macOS traffic lights keep close, minimize, and fullscreen behavior. The Windows
maximize button uses maximize/restore, separately from fullscreen.
