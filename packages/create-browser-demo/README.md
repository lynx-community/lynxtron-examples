# create-browser-demo

Create a standalone app from the same source as the [browser showcase](../../showcases/browser).

Build the template with `pnpm --filter create-browser-demo build`. The generator
uses `pnpm pack` to resolve catalog/workspace dependencies in the source package.

```sh
node packages/create-browser-demo/cli.js my-browser --no-web
cd my-browser
npm install
npm run start
```

Use `--web` to keep the original optional web host. `npm run pack` produces a
standalone desktop installer. See the generated README for CEF requirements.
