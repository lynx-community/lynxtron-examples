import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

// Only the gallery is built here. Every fiddle is a standalone project with its
// own single-entry build, assembled on demand — see scripts/assemble.mjs.
export default createShowcaseConfig({
  entry: './src/home/index.tsx',
  lynxDistPath: './output/bundle/lynx',
  server: { port: 5891 },
});
