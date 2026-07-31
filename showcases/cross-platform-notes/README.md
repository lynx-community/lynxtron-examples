# Cross-Platform Notes

Cross-Platform Notes proves that one Lynx UI can run against two host adapters:

- Desktop uses Lynxtron with a Node preload bridge and filesystem-backed note storage.
- Web uses the same shared `src/app` Lynx UI with a browser host adapter and browser-local note storage.
- Both targets build from the same app source while keeping platform code isolated under `src/main/desktop` and `src/main/web`.

The Web adapter is exposed through `lynxView.nativeModulesMap`. Its ESM module
runs in the Lynx BTS worker and forwards note operations through Web Core RPC to
`web-host.ts`, where the browser main thread can access `localStorage`. This is
the Web equivalent of the desktop preload bridge.

## Run Desktop

From this showcase directory:

```sh
pnpm run start
```

This builds the desktop artifact into `dist/desktop` and launches it with Lynxtron.

## Run Web

From this showcase directory:

```sh
pnpm run start:web
```

This builds the web artifact into `dist/web` and serves it with the local Node static server in `scripts/serve-web.mjs`.

To serve an already-built web artifact:

```sh
pnpm run serve:web
```
