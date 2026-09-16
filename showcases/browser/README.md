# Browser

Desktop showcase ported from `lynx-family/lynxtron`,
`src/packages/browser-demo` at `a94bd992435bc46f6fed57dbd73479a8ba765f8d`.
Upstream UI and icons are Apache-2.0 licensed; see LICENSE.

## Scope and runtime

- COPY: Lynx multi-tab UI, address bar, history navigation, reload, quick access,
page metadata bridge, CEF WebViews and custom window controls.
- ADAPT: shared showcase configuration, native-package AutoLink proxies in
  release builds, Windows app identity, tab-close/add handlers and TS imports;
  the public WebView `window.postMessage` metadata bridge, five-second metadata
  refresh, Clay input `setValue`, and explicit bridge reply arguments.
- DEFER: upstream web-host mode and standalone installers. This is a **desktop
  showcase**, not a UI-only example or an HTML browser app.

`dist/desktop/main.js` creates the window, loads `preload.js` and
`main.lynx.bundle`, and initializes `@lynx-js/cef-webview/lynxtron`. AutoLink
stages the native addon and CEF resources. No build-machine asset paths should
be embedded. The eventual tgz uses this repository's source + verified
`dist_precompiled/` format.

## Local checks

From the repository root (Node 22.18+):

```sh
corepack pnpm install
corepack pnpm --filter @lynxtron-examples/config build
corepack pnpm --filter @lynxtron-examples/browser test
corepack pnpm --filter @lynxtron-examples/browser typecheck
corepack pnpm --filter @lynxtron-examples/browser start
```

Golden flow: open the Lynx shortcut, confirm web content and page title, add a
second tab, navigate through the address bar, back/forward/reload, switch and
close tabs; closing the last tab closes the window. Also test failed navigation
and closing the process. Windows OSR/high-DPI must be checked on Windows.

For reproducible navigation/reload/popup checks without depending on an
external website, run `node showcases/browser/scripts/smoke-server.mjs` and
enter `http://127.0.0.1:18743` in the demo address bar. Stop the server afterwards.

## Release requirements

The workspace uses matching published 0.0.23 runtime, CEF and tooling packages.
`prepack` rejects old or mismatched versions; published stable Lynxtron, CEF
and dev-plugin versions **>= 0.0.23** are required. Repeat packaged-artifact
checks for each release. Windows may require a newer release containing
`a94bd99` (OSR animation/high-DPI fixes, after the 0.0.23 version commit).

CI binaries or locally built packages can be used for local verification, but
must not be substituted silently into an official tgz. A local green build is
not evidence of npm availability, cross-platform runtime support or readiness
to publish. No release is triggered by this migration alone.

## Local validation — 2026-09-16

- Passed: frozen-lockfile filtered install, TypeScript checks, 5 Node tests,
  production build, staged native asset check and checkout-path check.
- Native binaries: macOS arm64 release and devtool Runtime plus CEF from
  [run 34925876927](https://github.com/lynx-family/lynxtron/actions/runs/34925876927),
  version `0.0.23`, source `0adc71e8adaaff1a39374b4ee94917fa443647dc`.
  npm JS packages/build tooling remain `0.0.22`; the CI CEF binary was staged
  locally into the installed CEF package. This mixed **local-only** setup is
  deliberately not publishable and is not proof of the final npm/tgz workflow.
- Release runtime: homepage rendered; the owner confirmed typing the local
  fixture URL and seeing the green Browser smoke A page.
- Devtool runtime, complete dist copied outside the source/workspace tree:
  homepage, A/B navigation, title/address synchronization, back, forward, reload
  (new fixture timestamp), adding a tab and closing it back to the previous tab,
  connection-refused page, recovery through address input + Enter, and closing
  the final tab/process were checked. The relocated and built UI bundle hashes
  matched. Native addon and Framework/Helpers were loaded from the relocated
  dist, not the checkout's node_modules.
- Automation: Computer Use could capture this app, but coordinate clicks failed
  with `noWindowsAvailable`; name lookup selected a different installed runtime.
  DevTool session URL was matched to the relocated bundle before synthetic taps.
  Address submission/error recovery used real Return after DevTool input focus.
- Not accepted yet: Windows OSR/high-DPI, website popup/user-gesture behavior,
  all window-control variants, signed installers, formal tgz/Go consumption.
  CEF emits a duplicate `CrCoreCursor` class warning in the tested runtime.
  Failed-page metadata currently displays CEF's `chrome-error://` URL.

### Local Go deep-link validation (2026-09-16)

- Built Go 0.1.11 in `local-registry` mode and supplied
  `lynxtron-go://showcase/open?id=%40lynxtron-examples%2Fbrowser` through
  the running app's second-instance argv handler. Use the full scoped id.
  Development mode intentionally does not register the OS URL scheme.
- Go fetched a local test tgz, verified its source and artifact hashes, and
  skipped dependency installation. Clicking Run launched
  `~/.lynxtron-go/showcases/browser/dist_precompiled/desktop` (not the checkout).
  The child DevTool session matched that bundle path. Navigating its CEF view
  through DevTool to the local smoke fixture reported `Browser smoke A`.
- This exposed and fixed a release packer bug: `fs.cpSync` rewrote framework
  links to absolute build-machine paths, then tar extraction sanitized them,
  invalidating the artifact hash and breaking the links. Preserve links with
  `verbatimSymlinks`; a tar round-trip regression test now covers relocation.
- Local-only test packaging skipped prepack because npm packages still resolve
  to 0.0.22, while the runtime and CEF native artifacts came from the 0.0.23 CI
  build described above. The test archive must not be published as a release.
  The Go runtime resolver uses a local ignored symlink to that CI runtime.
- Still pending: coordinated published >=0.0.23 packages, alpha release assets,
  signed/notarized DMG installation, and macOS `open-url` delivery to that
  installed app. The local argv test does not claim to cover OS registration.
