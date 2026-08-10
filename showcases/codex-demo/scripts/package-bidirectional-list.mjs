import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const packageVersion = '0.1.0';
const packageName = `lynx-bidirectional-list-standalone-${packageVersion}`;
const outputRoot = path.resolve(projectRoot, process.argv[2] ?? 'artifacts');
const packageRoot = path.join(outputRoot, packageName);

const sourceRoot = path.join(projectRoot, 'src/app/components/bidirectional-list');
const labRoot = path.join(projectRoot, 'labs/bidirectional-list');

await rm(packageRoot, { recursive: true, force: true });
await mkdir(path.join(packageRoot, 'src/bidirectional-list'), { recursive: true });
await mkdir(path.join(packageRoot, 'demo'), { recursive: true });

await cp(sourceRoot, path.join(packageRoot, 'src/bidirectional-list'), {
  recursive: true,
});

const labSource = await readFile(path.join(labRoot, 'ListLab.tsx'), 'utf8');
await writeFile(
  path.join(packageRoot, 'demo/ListLab.tsx'),
  labSource.replace(
    "from '../../src/app/components/bidirectional-list'",
    "from '../src/bidirectional-list'",
  ),
);

const labCss = await readFile(path.join(labRoot, 'ListLab.css'), 'utf8');
await writeFile(
  path.join(packageRoot, 'demo/ListLab.css'),
  labCss.replace('@import "@lynxtron-examples/config/tokens.css";\n\n', ''),
);

await writeFile(path.join(packageRoot, 'demo/index.tsx'), `import { root } from '@lynx-js/react';
import { ListLab } from './ListLab';

root.render(<ListLab />);
`);

const packageJson = {
  name: 'lynx-bidirectional-list-standalone',
  version: packageVersion,
  private: true,
  description: 'Standalone Lynx BidirectionalList source, UI lab, tests, and prebuilt bundle',
  type: 'module',
  exports: {
    '.': './src/bidirectional-list/index.ts',
  },
  scripts: {
    build: 'rspeedy build',
    test: 'vitest run src/bidirectional-list',
    typecheck: 'tsc --noEmit -p tsconfig.json',
    check: 'npm run typecheck && npm test && npm run build',
  },
  engines: {
    node: '>=22',
  },
  dependencies: {
    '@lynx-js/react': '0.123.1',
  },
  devDependencies: {
    '@lynx-js/config-rsbuild-plugin': '0.2.0',
    '@lynx-js/react-rsbuild-plugin': '^0.18.1',
    '@lynx-js/rspeedy': '^0.16.1',
    '@lynx-js/type-config': '4.1.3',
    '@lynx-js/types': '4.1.0',
    typescript: '~5.9.3',
    vitest: '^3.2.4',
  },
};
await writeFile(
  path.join(packageRoot, 'package.json'),
  `${JSON.stringify(packageJson, null, 2)}\n`,
);

await writeFile(path.join(packageRoot, 'tsconfig.json'), `{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@lynx-js/react",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2023"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["@lynx-js/types"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "demo/**/*.ts", "demo/**/*.tsx"]
}
`);

await writeFile(path.join(packageRoot, 'lynx.config.ts'), `import { defineConfig } from '@lynx-js/rspeedy';
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import {
  compilerOptionsKeys,
  configKeys,
  type CompilerOptions,
  type Config,
} from '@lynx-js/type-config';

const lynxConfig = {
  alignMouseEventWithW3C: true,
  enableCSSInheritance: true,
  enableCSSInlineVariables: true,
};

export default defineConfig({
  output: { filename: '[name].[platform].bundle' },
  environments: {
    lynx: {
      source: { entry: { main: './demo/index.tsx' } },
      output: { distPath: { root: './dist' } },
    },
  },
  plugins: [
    pluginLynxConfig(lynxConfig, {
      configKeys: [...configKeys, 'alignMouseEventWithW3C', 'enableCSSInlineVariables'],
      compilerOptionsKeys,
      validate: (input) => input as Config & CompilerOptions & {
        alignMouseEventWithW3C: boolean;
        enableCSSInlineVariables: boolean;
      },
    }),
    pluginReactLynx({ enableCSSInheritance: true }),
  ],
});
`);

await writeFile(path.join(packageRoot, 'vitest.config.ts'), `import { defineConfig } from 'vitest/config';

// Keep test discovery local even when this package is unpacked inside another
// monorepo that has its own Vitest include/exclude rules.
export default defineConfig({
  test: {
    include: ['src/bidirectional-list/**/*.test.ts'],
    environment: 'node',
  },
});
`);

await writeFile(path.join(packageRoot, '.gitignore'), `node_modules/
dist/
*.log
.DS_Store
`);

await writeFile(path.join(packageRoot, 'README.md'), `# Lynx BidirectionalList standalone package

This zip is a **frontend-only** Lynx npm project. It includes the reusable list
source, deterministic unit tests, an interactive UI lab, and a prebuilt Lynx
bundle. It does not depend on the Codex Demo monorepo, a workspace package, the
Node main process, or Lynxtron.

## Build from source

Requirements: Node.js 22 or newer and npm.

\`\`\`bash
npm install
npm run build
\`\`\`

The output is \`dist/main.lynx.bundle\`. A lockfile and a prebuilt copy of this
bundle are included so the recipient can compare or use the artifact directly.
To run all source checks:

\`\`\`bash
npm run check
\`\`\`

## What is included

- \`src/bidirectional-list/\`: component, native adapter, headless transaction
  engine, stable signal machine, mock driver, and tests.
- \`demo/\`: a real Lynx list UI lab for prepend/append preserve/follow,
  underfill, variable row heights, bounces, edge state, and callback logs.
- \`lynx.config.ts\`: fully local RSpeedy config; no workspace imports.
- \`dist/main.lynx.bundle\`: prebuilt frontend bundle.
- \`PITFALLS.md\`: observed platform behavior versus defensive assumptions.

## Runtime note

The output is a Lynx frontend bundle, not a desktop executable. Load
\`dist/main.lynx.bundle\` in your Lynx host, Lynx Explorer, or your own
Lynxtron window. Host/bootstrap code is intentionally outside this package.

## Component boundary

\`BidirectionalList\` owns the supplied local sequence, serialized mutations,
anchor preservation, navigation, and normalized viewport/gesture signals. It
does **not** own remote cursors, \`hasMore\`, loading state, retries, or chat
pagination policy. Application data code should consume \`onListSignal\` and
\`getSignalSnapshot()\`, never raw native events from \`diagnostics\`.

See \`src/bidirectional-list/README.md\` for the detailed API contract.
`);

await writeFile(path.join(packageRoot, 'PITFALLS.md'), `# Lynx list integration pitfalls

The labels below matter: **observed** means it was reproduced while integrating
the demo; **defensive** means the code protects against a plausible/versioned
payload variation and should not be quoted as a confirmed Lynx bug.

| Status | Pitfall | Mitigation in this package |
| --- | --- | --- |
| Observed | A keyed child update with unchanged geometry may not emit \`layoutcomplete\`. | A short 160 ms fallback releases only the layout gate; anchor verification still runs. |
| Observed | \`layoutcomplete\` may happen before an imperative follow scroll reaches its final pixels. | Transaction settlement is separate from layout completion. |
| Observed | \`scrolltoupper\`/\`scrolltolower\` names alone do not prove exact geometry or user intent; layout/diff work can participate in the event pipeline. | Gate user signals by event source, gesture state, and measured geometry. |
| Observed | At a clamped edge, a repeated gesture can produce no new \`scroll\` event because no pixel changes. | Actively reconcile with \`getScrollInfo\` at gesture start/stop. |
| Observed | A single active query just after data/layout mutation can capture intermediate geometry. | Sample until two readings stabilize, with a bounded retry count. |
| Observed | A non-empty list can briefly report no attached cells/metrics during imperative settlement. | Retain the last valid geometry instead of publishing a false empty/edge state. |
| Observed | Event geometry appears under different nesting for layout and scroll event families. | Normalize \`detail.scrollInfo\` versus \`detail\` at one adapter boundary. |
| Observed | An imperative method success callback confirms command acceptance, not final layout. | Verify anchors, and settle append-follow only on newer exact-end geometry containing the new boundary item. |
| Observed | Repeated edge intent has unchanged pixel geometry. | Do not de-duplicate an exact, user-sourced upper/lower callback solely by its geometry signature. |
| Defensive | Cell query results may be an array or use \`cells\`, \`visibleCells\`, or \`attachedCells\`. | Normalize all known shapes in \`LynxListDriver\`; update adapter tests when SDK behavior is confirmed. |
| Defensive | Older \`scrollRange\` is less explicit than \`maxScrollOffset\`. | Prefer \`maxScrollOffset\`; isolate the legacy content-extent fallback in the driver. |
| Contract | Empty or underfilled content is geometrically at both edges even without scrolling. | Initial layout and active query may emit both reached states. |
| Contract | Prepend preservation requires stable unique keys. | Reject duplicate keys and map native cells through \`item-key\`. |
| Architecture | Remote pagination state does not belong in the rendering primitive. | Keep cursors, loading, retries and \`hasMore\` in the caller. |
| Performance | Forwarding every raw scroll diagnostic over a JS/native bridge can become its own bottleneck. | Raw diagnostics are lab-only and sampled; product logic consumes normalized signals. |

Search for \`PITFALL\` in the source to find the corresponding implementation
comments. If a future Lynx release clarifies a payload contract, update the
driver and tests rather than spreading version checks into the state machine.
`);

console.log(packageRoot);
