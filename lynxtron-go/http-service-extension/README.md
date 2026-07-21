# lynxtron-http-service

Native extension that registers a `LynxHttpService` with the Lynx engine's
`LynxServiceCenter`, enabling the standard
[Lynx Fetch API](https://lynxjs.org/guide/interaction/networking.html) in
UI-side JavaScript on Lynxtron desktop.

## Why

Lynx's `fetch` is a standard API, but per the Lynx docs it "depends on the
host-provided HTTP service". The Lynxtron desktop host registers no HTTP
service, so every UI-side `fetch()` fails inside the engine with
`request_func is unimplemented`. This extension supplies the missing service:

- **macOS**: `NSURLSession` (async, no extra dependencies)
- **Windows**: `WinHTTP` (per-request worker thread)

## Usage

Registered once from the desktop main process, before windows are created —
the service center is process-global, so one registration serves every
LynxView:

```js
require('lynxtron-http-service').setUp();
```

## ⚠️ Currently gated behind `LYNXTRON_ENABLE_HTTP_SERVICE=1`

The service itself works end-to-end (verified live: the engine's
`lynx_fetch_module` reaches it, the request goes out, the real response
comes back). But the engine's fetch module then hands the response body to
JS as a **zero-copy external ArrayBuffer**
(`lynx_fetch_module.cc`: `Napi::ArrayBuffer::New(env, body.content, …)`),
and Lynxtron's background JS runtime is a **sandbox-enabled V8**, which
makes any external backing store a process-fatal error:

```
FATAL ERROR: v8_ArrayBuffer_NewBackingStore When the V8 Sandbox is enabled,
ArrayBuffer backing stores must be allocated inside the sandbox address space.
```

Mobile hosts (PrimJS / JSC) don't have this restriction, which is why the
documented Fetch flow works there. Until the engine copies the body into a
V8-allocated buffer on desktop (a one-spot fix in
`platform/embedder/module/lynx_fetch_module.cc`), registering the service
would turn every body-bearing `fetch()` from a soft failure into a crash —
so registration is opt-in via the environment variable.

## Build

```sh
pnpm --dir ./http-service-extension run build   # cmake-js compile
```

Produces `build/Release/lynx_http_service_module.node`. Headers come from
`@lynx-js/lynx-library-headers` (`lynx_http_service.h`,
`lynx_service_center.h`); capi symbols resolve from the host binary at load
time (`-undefined dynamic_lookup` on macOS, `lynxtron.dll.lib` on Windows).
